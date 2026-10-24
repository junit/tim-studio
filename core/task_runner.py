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
from .tim_client import TimClient

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage"))
HISTORY_PATH = os.path.join(STORAGE_DIR, "history.json")


def load_history() -> List[dict]:
    if os.path.exists(HISTORY_PATH):
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load history: {e}")
    return []


def save_history_item(batch_record: dict):
    os.makedirs(STORAGE_DIR, exist_ok=True)
    history = load_history()
    history.insert(0, batch_record)
    # 最多保留 50 次批处理历史
    history = history[:50]
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def delete_history_item(task_id: str) -> bool:
    history = load_history()
    new_history = [h for h in history if h.get("task_id") != task_id]
    if len(new_history) != len(history):
        with open(HISTORY_PATH, "w", encoding="utf-8") as f:
            json.dump(new_history, f, ensure_ascii=False, indent=2)
        return True
    return False


def clear_history() -> bool:
    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump([], f, ensure_ascii=False, indent=2)
    return True


class BatchTask:
    def __init__(self, task_id: str, api_id: str, items: List[dict], delay_sec: float = 0.05, dry_run: bool = False):
        self.task_id = task_id
        self.api_id = api_id
        self.items = items
        self.delay_sec = delay_sec
        self.dry_run = dry_run
        self.total = len(items)
        self.current = 0
        self.success = 0
        self.failed = 0
        self.status = "PENDING"  # PENDING, RUNNING, PAUSED, CANCELLED, COMPLETED
        self.results = []
        self.event_queue = queue.Queue()
        self.start_time = None
        self.end_time = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # set means running, clear means paused

    def emit(self, event_type: str, data: dict):
        self.event_queue.put({"type": event_type, "data": data, "timestamp": time.time()})

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
        task = BatchTask(task_id, api_id, items, delay_sec=delay_sec, dry_run=dry_run)
        with self._lock:
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

        client = TimClient()
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
            payload = api_meta.build_payload(row)

            if task.dry_run:
                # 预览模式：不发网络请求，校验入参并构建报文
                action_status = "OK"
                err_code = 0
                err_info = "【预览演练】参数结构构建成功 (未发起真实网络请求)"
                cost_ms = 0
            else:
                # 调用真实 IM API 网关
                resp = client.invoke(api_meta.service_name, api_meta.command, payload)
                action_status = resp.get("ActionStatus", "FAIL")
                err_code = resp.get("ErrorCode", -1)
                err_info = resp.get("ErrorInfo", "")
                cost_ms = resp.get("_cost_ms", 0)

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

        task.end_time = time.time()
        duration_sec = round(task.end_time - task.start_time, 2)
        if task.status != "CANCELLED":
            task.status = "COMPLETED"

        summary = {
            "task_id": task.task_id,
            "api_id": task.api_id,
            "api_name": api_meta.name,
            "total": task.total,
            "success": task.success,
            "failed": task.failed,
            "duration_sec": duration_sec,
            "status": task.status,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(task.start_time))
        }
        task.emit("complete", summary)

        # 归档持久化
        save_history_item({
            **summary,
            "results": task.results
        })


task_runner = TaskRunner()
