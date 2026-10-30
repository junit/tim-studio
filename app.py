# -*- coding: utf-8 -*-
"""
腾讯云 IM 可视化管理控制台 - FastAPI 服务
"""

import csv
import io
import json
import os
import time
from typing import Any, Dict, List, Optional
import openpyxl
from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from core.config import (
    load_config,
    save_config,
    get_environments_payload,
    switch_environment,
    save_environment,
    delete_environment,
    mask_secret,
)
from core.registry import registry
from core.task_runner import (
    load_history,
    save_history_item,
    delete_history_item,
    clear_history,
    task_runner,
)
from core.tim_client import TimClient
from core.cloud_client import UniversalCloudClient
from core.live_util import generate_live_push_url, generate_live_play_urls, parse_live_stream_url
from core.doc_syncer import doc_sync_manager
from core.tree_syncer import sync_catalog_from_live_tree, fetch_official_hydration_tree
from core.common_specs_syncer import common_specs_manager
from apis.agent import router as agent_router

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="TC Studio (Nova) - Tencent Cloud Multi-Service Architecture Studio", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)


# ---------------- 静态资源路由 ----------------
@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_file):
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(index_file)


@app.get("/favicon.ico")
def serve_favicon():
    fav = os.path.join(STATIC_DIR, "favicon.svg")
    if os.path.exists(fav):
        return FileResponse(fav, media_type="image/svg+xml")
    raise HTTPException(status_code=404)


@app.get("/favicon.svg")
def serve_faviconsvg():
    fav = os.path.join(STATIC_DIR, "favicon.svg")
    if os.path.exists(fav):
        return FileResponse(fav, media_type="image/svg+xml")
    raise HTTPException(status_code=404)


# 挂载 Vite 构建输出静态资源目录
assets_dir = os.path.join(STATIC_DIR, "assets")
os.makedirs(assets_dir, exist_ok=True)
app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# ---------------- 多环境配置管理与鉴权 ----------------
class EnvironmentItem(BaseModel):
    id: Optional[str] = None
    name: str = "未命名环境"
    tag: Optional[str] = "DEV"
    remark: Optional[str] = ""
    # 腾讯云 IM 专属配置
    sdkappid: int = 0
    secret_key: Optional[str] = ""
    admin_user: str = "administrator"
    domain: str = "console.tim.qq.com"
    # 腾讯云 API 3.0 通用凭据 (云直播 / TRTC / VOD / COS 等通用)
    tc_secret_id: Optional[str] = ""
    tc_secret_key: Optional[str] = ""
    tc_region: Optional[str] = "ap-guangzhou"
    tc_endpoint: Optional[str] = "live.tencentcloudapi.com"
    # 云直播 (CSS) 专属配置 (推拉流域名与鉴权防盗链 Key)
    live_push_domain: Optional[str] = ""
    live_play_domain: Optional[str] = ""
    live_push_key: Optional[str] = ""
    live_play_key: Optional[str] = ""
    delay_sec: float = 0.05


class SwitchEnvRequest(BaseModel):
    env_id: str


class TestConnRequest(BaseModel):
    env_id: Optional[str] = None
    service: Optional[str] = None


@app.get("/api/environments")
def api_get_environments():
    return {"status": "success", "data": get_environments_payload(mask=True)}


@app.post("/api/environments/switch")
def api_switch_environment(req: SwitchEnvRequest):
    try:
        data = switch_environment(req.env_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/environments/save")
def api_save_environment(req: EnvironmentItem):
    try:
        data = save_environment(req.dict())
        saved_env = data.get("saved_env") or {}
        return {"status": "success", "data": saved_env, "payload": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/environments/{env_id}")
def api_delete_environment(env_id: str):
    try:
        data = delete_environment(env_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ConfigUpdate(BaseModel):
    sdkappid: int
    secret_key: str
    admin_user: str = "administrator"
    domain: str = "console.tim.qq.com"
    delay_sec: float = 0.05


@app.get("/api/config")
def get_config():
    cfg = load_config()
    masked = dict(cfg)
    masked["secret_key"] = mask_secret(masked.get("secret_key", ""))
    masked["has_secret"] = bool(cfg.get("secret_key"))
    return {"status": "success", "data": masked}


@app.post("/api/config")
def update_config(body: ConfigUpdate):
    cfg = load_config()
    active_env_id = cfg.get("active_env_id", "env_default")
    env_data = {
        "id": active_env_id,
        "sdkappid": body.sdkappid,
        "secret_key": body.secret_key,
        "admin_user": body.admin_user,
        "domain": body.domain,
        "delay_sec": body.delay_sec,
    }
    saved_payload = save_environment(env_data)
    return {"status": "success", "data": saved_payload["active_env"]}


@app.post("/api/config/test")
def test_connectivity(req: Optional[TestConnRequest] = None):
    cfg = load_config()
    env_id = req.env_id if req else None
    target = next((e for e in cfg["environments"] if e.get("id") == env_id), None) if env_id else cfg
    client = UniversalCloudClient(config=target)

    req_service = (req.service if req and req.service else "").lower()
    has_im = bool(target.get("sdkappid") and target.get("secret_key"))
    has_tc = bool(target.get("tc_secret_id") and target.get("tc_secret_key"))

    if not req_service:
        req_service = "live" if (has_tc and not has_im) else "im"

    try:
        res = client.test_connection(service=req_service)

        is_ok = (res.get("ActionStatus") == "OK" and res.get("ErrorCode") == 0)
        return {
            "status": "success" if is_ok else "fail",
            "is_ok": is_ok,
            "cost_ms": res.get("_cost_ms", 0),
            "service": req_service,
            "response": res
        }
    except Exception as e:
        return {"status": "error", "is_ok": False, "service": req_service, "message": str(e)}


# ---------------- 多服务与 API 注册工作台 ----------------
@app.get("/api/services")
def get_supported_services():
    """获取所有已支持的腾讯云产品服务列表 (IM、云直播等)"""
    return {"status": "success", "data": registry.list_services()}


@app.get("/api/apis")
def get_registered_apis(service: Optional[str] = None):
    return {"status": "success", "data": registry.list_apis(service_type=service)}


class LiveSignUrlRequest(BaseModel):
    domain: Optional[str] = None
    stream_name: str
    key: Optional[str] = None
    expire_seconds: Optional[int] = 86400
    app_name: Optional[str] = "live"
    type: Optional[str] = "both"  # "push", "play", "both"


@app.post("/api/live/sign-url")
def api_generate_live_url(req: LiveSignUrlRequest):
    """生成腾讯云直播推流与播放防盗链鉴权地址 (txSecret & txTime)"""
    cfg = load_config()
    push_domain = req.domain or cfg.get("live_push_domain") or "push.yourdomain.com"
    play_domain = req.domain or cfg.get("live_play_domain") or "play.yourdomain.com"
    push_key = req.key or cfg.get("live_push_key")
    play_key = req.key or cfg.get("live_play_key")

    push_info = generate_live_push_url(
        domain=push_domain,
        stream_name=req.stream_name,
        key=push_key,
        expire_seconds=req.expire_seconds or 86400,
        app_name=req.app_name or "live"
    )

    play_info = generate_live_play_urls(
        domain=play_domain,
        stream_name=req.stream_name,
        key=play_key,
        expire_seconds=req.expire_seconds or 86400,
        app_name=req.app_name or "live"
    )

    return {
        "status": "success",
        "data": {
            "stream_name": req.stream_name,
            "push": push_info,
            "play": play_info
        }
    }


class ApiInvokeRequest(BaseModel):
    payload: Dict[str, Any]
    dry_run: Optional[bool] = False


@app.post("/api/apis/{api_id}/invoke")
def invoke_single_api(api_id: str, req: ApiInvokeRequest):
    api_meta = registry.get_api(api_id)
    if not api_meta:
        raise HTTPException(status_code=404, detail=f"API {api_id} 未注册")

    client = UniversalCloudClient()
    payload = api_meta.build_payload(req.payload)

    # 预览模式：执行入参校验与请求报文结构生成，不发网络请求
    if req.dry_run:
        preview_data = client.generate_preview(api_meta, payload)
        return {
            "status": "success",
            "dry_run": True,
            "api_id": api_id,
            "service_name": api_meta.service_name,
            "service_type": getattr(api_meta, "service_type", "im"),
            "command": api_meta.command,
            "sent_payload": payload,
            "preview_url": preview_data.get("preview_url", ""),
            "curl_command": preview_data.get("curl_command", ""),
            "headers": preview_data.get("headers", {}),
            "response": {
                "ActionStatus": "OK",
                "ErrorCode": 0,
                "ErrorInfo": "",
                "_dry_run": True,
                "_message": "【预览模式】未向腾讯云发起真实网络请求。请求入参校验通过，报文结构与签名凭据已成功生成。"
            },
            "cost_ms": 1
        }

    resp = client.invoke_api(api_meta, payload)
    return {
        "status": "success",
        "dry_run": False,
        "api_id": api_id,
        "service_name": api_meta.service_name,
        "service_type": getattr(api_meta, "service_type", "im"),
        "command": api_meta.command,
        "sent_payload": payload,
        "response": resp,
        "cost_ms": resp.get("_cost_ms", 0)
    }


# ---------------- 官方结构化文档与异步批量同步 ----------------
class BatchSyncRequest(BaseModel):
    force: bool = False
    api_ids: Optional[List[str]] = None
    mode: Optional[str] = "auto"  # 'auto' | 'html' | 'api'
    service: Optional[str] = None  # 'im' | 'live' | 'all'


@app.get("/api/docs/summary")
def get_docs_summary(service: Optional[str] = Query(None)):
    apis_list = registry.list_apis()
    if service and service != "all":
        apis_list = [a for a in apis_list if (a.get("service_type") or "im") == service]
    summary = doc_sync_manager.get_summary(apis_list)
    return {"status": "success", "data": summary}


@app.get("/api/docs/sync/status")
def get_docs_sync_status():
    status = doc_sync_manager.get_status()
    return {"status": "success", "data": status}


@app.post("/api/docs/sync/batch")
def start_batch_docs_sync(req: BatchSyncRequest = BatchSyncRequest()):
    all_apis = registry.list_apis()
    if req.api_ids:
        target_set = set(req.api_ids)
        target_apis = [a for a in all_apis if a.get("api_id") in target_set]
    elif req.service and req.service != "all":
        target_apis = [a for a in all_apis if (a.get("service_type") or "im") == req.service]
    else:
        target_apis = all_apis

    res = doc_sync_manager.start_batch_sync(target_apis, force=req.force, mode=req.mode or "auto")
    return {"status": "success", "data": res}


@app.post("/api/docs/sync/cancel")
def cancel_batch_docs_sync():
    res = doc_sync_manager.cancel_batch_sync()
    return {"status": "success", "data": res}


@app.post("/api/docs/tree/sync")
def sync_official_tree():
    try:
        res = sync_catalog_from_live_tree()
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步官方目录树失败: {str(e)}")


@app.post("/api/live/catalog/sync")
def sync_official_live_catalog():
    """动态同步腾讯云官方直播 (CSS) 260+ 全量 API"""
    try:
        from scripts.sync_live_catalog import sync_all_live_apis
        catalog = sync_all_live_apis()
        registry.reload()
        return {"status": "success", "count": len(catalog)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步云直播官方接口失败: {str(e)}")


@app.get("/api/docs/tree/raw")
def get_raw_official_tree():
    snapshot_path = os.path.join(BASE_DIR, "storage", "official_live_tree.json")
    if os.path.exists(snapshot_path):
        with open(snapshot_path, "r", encoding="utf-8") as f:
            return {"status": "success", "data": json.load(f)}
    try:
        raw_tree, _ = fetch_official_hydration_tree()
        return {"status": "success", "data": raw_tree}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取官方目录树快照失败: {str(e)}")


@app.get("/api/docs/{api_id}")
def get_api_doc(api_id: str):
    api = registry.get_api(api_id)
    if not api:
        api = registry.get_api(f"tim_{api_id}")
    if not api:
        raise HTTPException(status_code=404, detail=f"API {api_id} 未找到")

    doc = doc_sync_manager.get_doc_for_api(api.to_metadata())
    return {"status": "success", "data": doc}


@app.post("/api/docs/sync/{api_id}")
def sync_single_api_doc(api_id: str, mode: str = Query("auto")):
    api = registry.get_api(api_id)
    if not api:
        api = registry.get_api(f"tim_{api_id}")
    if not api:
        raise HTTPException(status_code=404, detail=f"API {api_id} 未找到")

    meta = api.to_metadata()
    doc_id = meta.get("doc_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="该接口未配置官方文档 ID")

    try:
        doc = doc_sync_manager.sync_single(
            doc_id,
            api_id=meta.get("api_id", api_id),
            doc_url=meta.get("doc_url", ""),
            mode=mode
        )
        return {"status": "success", "data": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步官方文档失败: {str(e)}")


# ---------------- 腾讯云 API 3.0 公共规范与数据结构 ----------------
@app.get("/api/common-specs")
def get_common_specs(service: str = Query("live"), category: Optional[str] = Query(None)):
    specs = common_specs_manager.get_specs(service=service)
    if category:
        if category in specs:
            return {"status": "success", "data": specs[category]}
        elif category in specs.get("invocation", {}):
            return {"status": "success", "data": specs["invocation"][category]}
        raise HTTPException(status_code=404, detail=f"Category '{category}' 未在公共规范中找到")
    return {"status": "success", "data": specs}


@app.get("/api/common-specs/error-lookup")
def lookup_common_error(code: str = Query(..., description="错误码，如 FailedOperation.StreamNotExist")):
    err = common_specs_manager.lookup_error(code)
    if not err:
        return {"status": "not_found", "message": f"未在官方错误码库中找到 {code}", "data": None}
    return {"status": "success", "data": err}


@app.post("/api/common-specs/sync")
def sync_common_specs(service: str = Query("live")):
    try:
        specs = common_specs_manager.sync_all(service=service)
        return {
            "status": "success",
            "message": "公共规范同步完成",
            "data": {
                "service": service,
                "updated_at": specs.get("updated_at"),
                "total_docs": specs.get("total_docs"),
                "structs_count": specs.get("structs", {}).get("total_count", 0),
                "errors_count": specs.get("errors", {}).get("total_count", 0),
                "countries_count": specs.get("mappings", {}).get("countries_count", 0),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步公共规范失败: {str(e)}")


# ---------------- 批处理任务 ----------------
@app.post("/api/batch/upload")
async def upload_batch_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    content = await file.read()
    rows = []

    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
        sheet = wb.active
        all_rows = list(sheet.iter_rows(values_only=True))
        if not all_rows:
            return {"status": "fail", "message": "Excel 文件为空"}
        header = [str(c or "").strip() for c in all_rows[0]]
        for r in all_rows[1:]:
            if any(r):
                row_dict = {}
                for h, val in zip(header, r):
                    if h:
                        row_dict[h] = str(val) if val is not None else ""
                rows.append(row_dict)
    elif filename.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="ignore")
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            rows.append({k.strip(): str(v).strip() for k, v in r.items() if k})
    elif filename.endswith(".json"):
        text = content.decode("utf-8", errors="ignore")
        data = json.loads(text)
        if isinstance(data, list):
            rows = data
        else:
            return {"status": "fail", "message": "JSON 必须为对象数组格式"}
    else:
        return {"status": "fail", "message": "仅支持 .xlsx, .csv, .json 格式文件"}

    return {
        "status": "success",
        "filename": file.filename,
        "total_rows": len(rows),
        "columns": list(rows[0].keys()) if rows else [],
        "preview": rows[:10],
        "rows": rows
    }


@app.get("/api/batch/presets")
def get_batch_presets(service: Optional[str] = None):
    """获取常用运维场景预设清单，支持按 service 过滤"""
    from core.batch_presets import BATCH_PRESETS
    if service:
        filtered = [p for p in BATCH_PRESETS if p.get("service_type", "im") == service]
        return {"status": "success", "data": filtered}
    return {"status": "success", "data": BATCH_PRESETS}


@app.get("/api/batch/presets/{preset_id}/csv")
def download_preset_csv(preset_id: str):
    """直接下载该预设的标准 CSV 模板（含 UTF-8 BOM，Excel 双击无乱码）"""
    from core.batch_presets import BATCH_PRESETS
    preset = next((p for p in BATCH_PRESETS if p["id"] == preset_id), None)
    if not preset:
        raise HTTPException(status_code=404, detail="预设模版未找到")

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.DictWriter(output, fieldnames=preset["columns"])
    writer.writeheader()
    for row in preset["sample_rows"]:
        writer.writerow({col: row.get(col, "") for col in preset["columns"]})

    csv_data = output.getvalue()
    return Response(
        content=csv_data.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{preset["filename"]}"'}
    )


@app.get("/api/batch/guidance/{api_id}")
def get_batch_guidance_api(api_id: str):
    """获取指定 API 的批量调用安全建议、QPS 限速规则与风控提示"""
    from core.batch_presets import get_api_batch_guidance
    data = get_api_batch_guidance(api_id)
    return {"status": "success", "data": data}


class CreateBatchRequest(BaseModel):
    api_id: str
    items: List[dict]
    delay_sec: Optional[float] = 0.05
    dry_run: Optional[bool] = False


@app.post("/api/batch/create")
def create_batch_task(req: CreateBatchRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail="任务列表不能为空")
    task = task_runner.create_task(req.api_id, req.items, delay_sec=req.delay_sec, dry_run=req.dry_run or False)
    task_runner.start_task(task.task_id)
    return {
        "status": "success",
        "task_id": task.task_id,
        "total": task.total,
        "api_id": task.api_id,
        "dry_run": req.dry_run or False
    }


@app.get("/api/batch/{task_id}/events")
def stream_batch_events(task_id: str):
    task = task_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    def event_generator():
        while True:
            try:
                # 从事件队列获取
                evt = task.event_queue.get(timeout=1.0)
                yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"
                if evt.get("type") in ("complete", "error"):
                    break
            except Exception:
                # 队列为空时发送心跳保持连接
                if task.status in ("COMPLETED", "CANCELLED", "FAILED"):
                    break
                yield ": keep-alive\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/batch/{task_id}/pause")
def pause_task(task_id: str):
    task = task_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.pause()
    return {"status": "success", "task_status": task.status}


@app.post("/api/batch/{task_id}/resume")
def resume_task(task_id: str):
    task = task_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.resume()
    return {"status": "success", "task_status": task.status}


@app.post("/api/batch/{task_id}/stop")
def stop_task(task_id: str):
    task = task_runner.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.stop()
    return {"status": "success", "task_status": task.status}


@app.get("/api/batch/{task_id}/export/csv")
def export_csv(task_id: str, only_failed: bool = False):
    task = task_runner.get_task(task_id)
    if not task or not task.results:
        # 尝试从 history 中查询
        history = load_history()
        match = next((h for h in history if h.get("task_id") == task_id), None)
        if match and match.get("results"):
            results = match["results"]
        else:
            raise HTTPException(status_code=404, detail="Task results not found")
    else:
        results = task.results

    if only_failed:
        results = [r for r in results if r.get("_status") != "OK" or r.get("_err_code") != 0]

    output = io.StringIO()
    if results:
        fieldnames = list(dict.fromkeys(k for r in results for k in r.keys()))
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    output.seek(0)
    filename_suffix = "failed_items" if only_failed else "results"
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=batch_{task_id}_{filename_suffix}.csv"}
    )


# ---------------- 历史归档 ----------------
@app.get("/api/history")
def get_history_list():
    history = load_history()
    # 如果 history 为空但存在 withdraw_results.json，自动生成一条初始历史记录
    if not history:
        prev_res_path = os.path.join(BASE_DIR, "withdraw_results.json")
        if os.path.exists(prev_res_path):
            try:
                with open(prev_res_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    init_record = {
                        "task_id": "init_208",
                        "api_id": "c2c_msg_withdraw",
                        "api_name": "撤回单聊消息 (历史归档)",
                        "total": len(data),
                        "success": sum(1 for d in data if d.get("status") == "OK" and d.get("err_code") == 0),
                        "failed": sum(1 for d in data if not (d.get("status") == "OK" and d.get("err_code") == 0)),
                        "duration_sec": 53.28,
                        "status": "COMPLETED",
                        "created_at": "2026-10-23 15:18:00",
                        "results": data
                    }
                    save_history_item(init_record)
                    history = [init_record]
            except Exception:
                pass

    # 列表仅返回摘要，不带 results 大数据
    summary_list = []
    for h in history:
        item = dict(h)
        if "results" in item:
            item["result_count"] = len(item["results"])
            del item["results"]
        summary_list.append(item)
    return {"status": "success", "data": summary_list}


@app.get("/api/history/{task_id}")
def get_history_detail(task_id: str):
    history = load_history()
    match = next((h for h in history if h.get("task_id") == task_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="History record not found")
    return {"status": "success", "data": match}


@app.delete("/api/history/{task_id}")
def delete_single_history(task_id: str):
    success = delete_history_item(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="History record not found")
    return {"status": "success", "message": f"Task {task_id} deleted"}


@app.delete("/api/history")
def delete_all_history():
    clear_history()
    return {"status": "success", "message": "All history records cleared"}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("🚀 TC Studio (Nova) - 腾讯云多业务云架构控制台启动中...")
    print("👉 请在浏览器打开: http://127.0.0.1:8000")
    print("=" * 60 + "\n")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
