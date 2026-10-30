# -*- coding: utf-8 -*-
"""
批处理任务调度器与 SSE 事件流推送
"""

import asyncio
import csv
import json
import os
import queue
import threading
import time
import uuid
from typing import Any, Dict, Generator, List, Optional

from .config import load_config
from .registry import registry
from .cloud_client import UniversalCloudClient
from .tim_client import TimClient

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage"))
HISTORY_PATH = os.path.join(STORAGE_DIR, "history.json")
_history_lock = threading.Lock()
MAX_CACHED_TASKS = 50


def _atomic_dump_json(filepath: str, data: Any, indent: int = 2) -> None:
    """原子化写入 JSON 文件，避免多线程并发导致历史文件截断损坏"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    tmp_path = f"{filepath}.{os.getpid()}.{threading.get_ident()}.{int(time.time() * 1000)}.tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
        os.replace(tmp_path, filepath)
    except Exception:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        raise


def load_history() -> List[dict]:
    with _history_lock:
        if os.path.exists(HISTORY_PATH):
            try:
                with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[WARN] Failed to load history: {e}")
        return []


def save_history_item(batch_record: dict):
    with _history_lock:
        os.makedirs(STORAGE_DIR, exist_ok=True)
        history = []
        if os.path.exists(HISTORY_PATH):
            try:
                with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                history = []
        history.insert(0, batch_record)
        # 最多保留 50 次批处理历史
        history = history[:50]
        _atomic_dump_json(HISTORY_PATH, history, indent=2)


def delete_history_item(task_id: str) -> bool:
    with _history_lock:
        if not os.path.exists(HISTORY_PATH):
            return False
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                history = json.load(f)
        except Exception:
            return False
        new_history = [h for h in history if h.get("task_id") != task_id]
        if len(new_history) != len(history):
            _atomic_dump_json(HISTORY_PATH, new_history, indent=2)
            return True
        return False


def clear_history() -> bool:
    with _history_lock:
        _atomic_dump_json(HISTORY_PATH, [], indent=2)
        return True


class BatchTask:
    def __init__(self, task_id: str, api_id: str, items: List[dict], delay_sec: float = 0.05, dry_run: bool = False, config_snapshot: Optional[dict] = None):
        self.task_id = task_id
        self.api_id = api_id
        self.items = items
        self.delay_sec = delay_sec
        self.dry_run = dry_run
        self.config_snapshot = config_snapshot
        self.total = len(items)
        self.current = 0
        self.success = 0
        self.failed = 0
        self.status = "PENDING"  # PENDING, RUNNING, PAUSED, CANCELLED, COMPLETED, FAILED
        self.results = []
        self.events: List[dict] = []
        self.event_queue = queue.Queue()  # 兼容向后单队列引用
        self._subscribers: List[queue.Queue] = []
        self._lock = threading.Lock()
        self.start_time = None
        self.end_time = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # set means running, clear means paused

    def register_subscriber(self) -> tuple:
        """注册新订阅者并获取全量历史事件快照，支持无感重连防事件撕裂"""
        q = queue.Queue()
        with self._lock:
            self._subscribers.append(q)
            history = list(self.events)
        return q, history

    def unregister_subscriber(self, q: queue.Queue):
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def emit(self, event_type: str, data: dict):
        evt = {"type": event_type, "data": data, "timestamp": time.time()}
        with self._lock:
            self.events.append(evt)
            subs = list(self._subscribers)
        # 兼容老版单队列
        try:
            self.event_queue.put_nowait(evt)
        except Exception:
            pass
        for sub in subs:
            try:
                sub.put_nowait(evt)
            except Exception:
                pass

    def stop(self):
        self._stop_event.set()
        self.status = "CANCELLED"

    def pause(self):
        self._pause_event.clear()
        self.status = "PAUSED"

    def resume(self):
        self._pause_event.set()
        self.status = "RUNNING"


class TaskRunner:
    def __init__(self):
        self.tasks: Dict[str, BatchTask] = {}
        self._lock = threading.Lock()

    def create_task(self, api_id: str, items: List[dict], delay_sec: float = None, dry_run: bool = False) -> BatchTask:
        cfg = load_config()
        if delay_sec is None:
            delay_sec = cfg.get("delay_sec", 0.05)
        task_id = str(uuid.uuid4())[:8]
        # 快照当前激活配置，确保任务执行期间不受全局环境切换影响，彻底做到凭证隔离
        config_snapshot = dict(cfg)
        task = BatchTask(task_id, api_id, items, delay_sec=delay_sec, dry_run=dry_run, config_snapshot=config_snapshot)
        with self._lock:
            # 淘汰超出缓存上限的陈旧任务，控制内存
            if len(self.tasks) >= MAX_CACHED_TASKS:
                completed_keys = [k for k, t in self.tasks.items() if t.status in ("COMPLETED", "CANCELLED", "FAILED")]
                for k in completed_keys[: len(self.tasks) - MAX_CACHED_TASKS + 1]:
                    self.tasks.pop(k, None)
            self.tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Optional[BatchTask]:
        return self.tasks.get(task_id)

    def start_task(self, task_id: str):
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        threading.Thread(target=self._worker, args=(task,), daemon=True).start()

    def _worker(self, task: BatchTask):
        task.status = "RUNNING"
        task.start_time = time.time()
        api_meta = registry.get_api(task.api_id)
        if not api_meta:
            task.emit("error", {"message": f"API {task.api_id} 未注册"})
            task.status = "FAILED"
            return

        try:
            # 使用该任务创建时固化的独立配置快照实例化统一云客户端
            client = UniversalCloudClient(config=task.config_snapshot)
            task.emit("start", {
                "task_id": task.task_id,
                "api_id": task.api_id,
                "api_name": api_meta.name,
                "total": task.total
            })

            for idx, row in enumerate(task.items, start=1):
                if task._stop_event.is_set():
                    break

                # 暂停控制
                task._pause_event.wait()
                task.current = idx

                try:
                    payload = api_meta.build_payload(row)
                    if task.dry_run:
                        # 预览模式：不发网络请求，校验入参并构建报文
                        action_status = "OK"
                        err_code = 0
                        err_info = "【预览演练】参数结构构建成功 (未发起真实网络请求)"
                        cost_ms = 0
                    else:
                        # 调用统一云网关驱动 (根据 service_type 自动分发至 IM 或 API 3.0)
                        resp = client.invoke_api(api_meta, payload)
                        action_status = resp.get("ActionStatus", "FAIL")
                        err_code = resp.get("ErrorCode", -1)
                        err_info = resp.get("ErrorInfo", "")
                        cost_ms = resp.get("_cost_ms", 0)
                except Exception as item_err:
                    action_status = "FAIL"
                    err_code = -999
                    err_info = f"参数转换或执行异常: {str(item_err)}"
                    cost_ms = 0

                is_ok = (action_status == "OK" and err_code == 0)
                if is_ok:
                    task.success += 1
                else:
                    task.failed += 1

                result_item = {
                    **row,
                    "_status": action_status,
                    "_err_code": err_code,
                    "_err_info": err_info,
                    "_cost_ms": cost_ms
                }
                task.results.append(result_item)

                task.emit("progress", {
                    "index": idx,
                    "total": task.total,
                    "current": idx,
                    "success": task.success,
                    "failed": task.failed,
                    "percent": round(idx / task.total * 100, 1),
                    "is_ok": is_ok,
                    "err_code": err_code,
                    "err_info": err_info,
                    "cost_ms": cost_ms,
                    "item": result_item
                })

                if task.delay_sec > 0:
                    time.sleep(task.delay_sec)
        except Exception as global_err:
            task.status = "FAILED"
            task.emit("error", {"message": f"批处理工作线程异常中断: {str(global_err)}"})
            return
        finally:
            task.end_time = time.time()
            duration_sec = round(task.end_time - (task.start_time or task.end_time), 2)
            if task.status != "CANCELLED" and task.status != "FAILED":
                task.status = "COMPLETED"

            summary = {
                "task_id": task.task_id,
                "api_id": task.api_id,
                "api_name": api_meta.name if api_meta else task.api_id,
                "service_type": getattr(api_meta, "service_type", "im") if api_meta else "im",
                "total": task.total,
                "success": task.success,
                "failed": task.failed,
                "duration_sec": duration_sec,
                "status": task.status,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(task.start_time or time.time()))
            }
            task.emit("complete", summary)

            # 归档持久化
            try:
                save_history_item({
                    **summary,
                    "results": task.results
                })
            except Exception as e:
                print(f"[WARN] Failed to save batch history: {e}")


task_runner = TaskRunner()
