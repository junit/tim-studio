# -*- coding: utf-8 -*-
"""
从 tim.js 提取的 166 个 REST API 页面构建官方全量 REST API 目录与元数据
"""

import concurrent.futures
import gzip
import html
import json
import os
import re
import sys
import urllib.request

# 加入当前目录
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.registry import registry

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAGES_FILE = os.path.join(os.path.dirname(__file__), "full_rest_pages.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "core", "tim_full_catalog.json")

# 1. 抓取 1520 表格快速映射
def load_1520_mappings():
    url = "https://cloud.tencent.com/document/product/269/1520"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    m = {}
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            try:
                data = gzip.decompress(raw)
            except Exception:
                data = raw
            h = data.decode("utf-8", errors="ignore")
            rows = re.findall(r"<tr[^>]*>(.*?)</tr>", h, re.DOTALL)
            for r in rows:
                doc_ids = re.findall(r"/document/product/269/(\d+)", r)
                cmds = re.findall(r"v4/([a-zA-Z0-9_]+/[a-zA-Z0-9_]+)", r)
                if doc_ids and cmds:
                    valid = [c for c in cmds if not c.startswith(("css", "ui", "gateway"))]
                    if valid:
                        m[int(doc_ids[0])] = valid[0]
    except Exception as e:
        print(f"[WARN] Failed to load 1520 mappings: {e}")
    return m


def clean_json_text(raw_text):
    text = re.sub(r"//[^\n]*", "", raw_text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    text = re.sub(r"\.\.\.+", "", text)
    text = re.sub(r",\s*([\}\]])", r"\1", text)
    try:
        return json.loads(text)
    except Exception:
        # 正则提取键值对
        pairs = re.findall(r"\"([a-zA-Z0-9_]+)\"\s*:\s*([^\n,]+)", text)
        res = {}
        for k, v in pairs:
            v = v.strip()
            if v.startswith('"') and v.endswith('"'):
                res[k] = v[1:-1]
            elif v.isdigit():
                res[k] = int(v)
            elif v in ("true", "false"):
                res[k] = (v == "true")
            elif v.startswith("["):
                res[k] = []
            elif v.startswith("{"):
                res[k] = {}
            else:
                res[k] = v.strip('"')
        return res


def fetch_doc_details(doc_id: int):
    url = f"https://cloud.tencent.com/document/product/269/{doc_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    cmd = ""
    desc = ""
    sample_payload = {}
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            try:
                data = gzip.decompress(raw)
            except Exception:
                data = raw
            text = data.decode("utf-8", errors="ignore")

            # 1. 提取请求 URL
            req_urls = re.findall(r"https?://[^\s\"\'<>]+[\\/]*v4[\\/]+([a-zA-Z0-9_]+)[\\/]+([a-zA-Z0-9_]+)\?", text)
            if req_urls:
                valid = [(s, a) for s, a in req_urls if not s.startswith(("css", "ui", "gateway", "documentation"))]
                if valid:
                    cmd = f"v4/{valid[0][0]}/{valid[0][1]}"
            if not cmd:
                all_v4 = re.findall(r"v4[\\/]+([a-zA-Z0-9_]+)[\\/]+([a-zA-Z0-9_]+)", text)
                valid = [(s, a) for s, a in all_v4 if not s.startswith(("css", "ui", "gateway", "documentation", "pandect"))]
                if valid:
                    cmd = f"v4/{valid[0][0]}/{valid[0][1]}"

            # 2. 提取功能描述
            desc_m = re.search(r"(?:功能说明|接口说明).*?<div[^>]*>(.*?)</div>", text, re.DOTALL)
            if desc_m:
                d = html.unescape(re.sub(r"<[^>]+>", "", desc_m.group(1))).strip()
                d = " ".join(d.split())
                if not d.startswith("!function") and len(d) > 5:
                    desc = d[:200]
            if not desc:
                m2 = re.search(r"data-slate-string=\"true\">([^<]*?(?:管理|接口|通过|支持|拉取|设置|查询)[^<]*?)</span>", text)
                if m2:
                    desc = m2.group(1).strip()[:150]

            # 3. 提取请求示例 JSON
            pres = re.findall(r"<pre[^>]*class=[\"\x27][^\"\x27]*code-block[^\"\x27]*[\"\x27][^>]*>(.*?)</pre>", text, re.DOTALL)
            for pr in pres:
                clean = html.unescape(re.sub(r"<[^>]+>", "", pr)).strip()
                if clean.startswith("{"):
                    parsed = clean_json_text(clean)
                    if parsed and not any(k in parsed for k in ("ActionStatus", "ErrorCode", "ErrorInfo")):
                        sample_payload = parsed
                        break
    except Exception as e:
        print(f"[WARN] Error fetching doc {doc_id}: {e}")

    return {
        "command": cmd,
        "desc": desc,
        "sample_payload": sample_payload
    }


def infer_fields_from_payload(payload: dict) -> list:
    fields = []
    for k, v in payload.items():
        t = "string"
        default_val = v
        placeholder = f"请输入 {k}"
        if isinstance(v, bool):
            t = "boolean"
        elif isinstance(v, int):
            t = "number"
        elif isinstance(v, list):
            t = "list"
            placeholder = "多个项用逗号分隔，或填写 JSON 数组"
        elif isinstance(v, dict):
            t = "json"
            placeholder = "JSON 对象"

        # 智能标签与中文别名
        label = k
        if "account" in k.lower():
            label = f"{k} (用户账号)"
        elif "group" in k.lower():
            label = f"{k} (群组标识)"
        elif "msg" in k.lower():
            label = f"{k} (消息标识/内容)"

        fields.append({
            "name": k,
            "label": label,
            "type": t,
            "required": True,
            "default": default_val,
            "placeholder": placeholder,
            "help_text": f"参数 {k}",
            "aliases": [k, k.lower(), k.replace("_", "")]
        })
    return fields


def main():
    print("Loading pages and existing registry...")
    registry.discover()
    existing_apis = registry.list_apis()
    existing_by_cmd = {}
    existing_by_name = {}
    for a in existing_apis:
        cmd = a.get("command", "")
        svc = a.get("service_name", "")
        if cmd:
            existing_by_cmd[cmd] = a
            existing_by_cmd[f"v4/{svc}/{cmd}"] = a
        if a.get("name"):
            existing_by_name[a["name"]] = a

    with open(PAGES_FILE, "r", encoding="utf-8") as f:
        pages = json.load(f)

    # 过滤掉简介和目录索引文档 1519, 1520
    api_pages = [p for p in pages if p["doc_id"] not in (1519, 1520)]
    print(f"Total REST API endpoints: {len(api_pages)}")

    map_1520 = load_1520_mappings()
    print(f"Loaded {len(map_1520)} mappings from doc 1520.")

    # 并发抓取/补全
    doc_results = {}

    def worker(p):
        doc_id = p["doc_id"]
        res = fetch_doc_details(doc_id)
        if not res["command"] and doc_id in map_1520:
            res["command"] = f"v4/{map_1520[doc_id]}"
        return doc_id, res

    print("Fetching doc details in parallel...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        for doc_id, res in executor.map(worker, api_pages):
            doc_results[doc_id] = res

    full_catalog = []

    for p in api_pages:
        doc_id = p["doc_id"]
        title = p["title"]
        path = p["path"]
        fetched = doc_results.get(doc_id, {})
        raw_cmd = fetched.get("command") or (f"v4/{map_1520[doc_id]}" if doc_id in map_1520 else "")

        # 归一化 service_name 与 action
        clean_cmd = raw_cmd
        if clean_cmd.startswith("v4/"):
            clean_cmd = clean_cmd[3:]
        parts = clean_cmd.split("/", 1)
        service_name = parts[0] if len(parts) > 1 else ""
        action = parts[1] if len(parts) > 1 else parts[0]

        # 检查是否在原有已有类中
        matched_existing = existing_by_name.get(title) or existing_by_cmd.get(action) or existing_by_cmd.get(f"v4/{service_name}/{action}")

        # 层级计算
        category = path[0] if len(path) > 0 else "其它分类"
        if len(path) > 1:
            subcategory = " > ".join(path[1:])
        else:
            subcategory = category

        api_id = f"tim_{doc_id}"
        if matched_existing and matched_existing.get("api_id"):
            api_id = matched_existing["api_id"]
        elif action:
            api_id = f"{service_name}_{action}".replace("-", "_").lower()

        # 合并字段与示例
        if matched_existing and matched_existing.get("fields"):
            fields = matched_existing["fields"]
            sample_payload = matched_existing.get("sample_payload") or fetched.get("sample_payload") or {}
            desc = matched_existing.get("description") or fetched.get("desc") or f"腾讯云 IM {title} 官方接口"
        else:
            sample_payload = fetched.get("sample_payload") or {}
            fields = infer_fields_from_payload(sample_payload)
            desc = fetched.get("desc") or f"腾讯云 IM {title} 官方接口"

        item = {
            "api_id": api_id,
            "doc_id": doc_id,
            "name": title,
            "category": category,
            "subcategory": subcategory,
            "path": path,
            "service_name": service_name,
            "command": action,
            "full_command": f"v4/{service_name}/{action}" if service_name else action,
            "doc_url": f"https://cloud.tencent.com/document/product/269/{doc_id}",
            "description": desc,
            "fields": fields,
            "sample_payload": sample_payload
        }
        full_catalog.append(item)

    print(f"Catalog generated with {len(full_catalog)} entries.")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(full_catalog, f, ensure_ascii=False, indent=2)
    print(f"Saved full catalog to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
