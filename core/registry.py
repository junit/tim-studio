# -*- coding: utf-8 -*-
"""
API 注册中心与动态发现：整合官方 166 个 REST API 完整树型目录与自定义处理器
"""

import importlib
import json
import os
import pkgutil
from typing import Dict, List, Optional, Type

from apis.base import BaseTimApi, Field


class DynamicTimApi(BaseTimApi):
    def __init__(self, data: dict):
        self.api_id = data.get("api_id", "")
        self.doc_id = data.get("doc_id", 0)
        self.name = data.get("name", "")
        self.category = data.get("category", "")
        self.subcategory = data.get("subcategory", "")
        self.path = data.get("path", [])
        self.service_name = data.get("service_name", "")
        self.command = data.get("command", "")
        self.doc_url = data.get("doc_url", "")
        self.description = data.get("description", "")
        self.sample_payload = data.get("sample_payload", {})
        self.fields = [
            Field(
                name=f.get("name"),
                label=f.get("label", f.get("name")),
                type=f.get("type", "string"),
                required=f.get("required", True),
                default=f.get("default"),
                placeholder=f.get("placeholder", ""),
                help_text=f.get("help_text", ""),
                aliases=f.get("aliases", [])
            )
            for f in data.get("fields", [])
        ]


class ApiRegistry:
    def __init__(self):
        self._apis: Dict[str, BaseTimApi] = {}
        self._ordered_apis: List[BaseTimApi] = []
        self._discovered = False

    def discover(self):
        if self._discovered:
            return

        # 1. 发现已有的自定义 python 类
        apis_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apis"))
        custom_apis_by_id: Dict[str, BaseTimApi] = {}
        custom_apis_by_name: Dict[str, BaseTimApi] = {}
        custom_apis_by_full_cmd: Dict[str, BaseTimApi] = {}

        for _, module_name, is_pkg in pkgutil.iter_modules([apis_dir]):
            if module_name == "base" or is_pkg:
                continue
            full_module_name = f"apis.{module_name}"
            try:
                mod = importlib.import_module(full_module_name)
                for attr_name in dir(mod):
                    attr = getattr(mod, attr_name)
                    if isinstance(attr, type) and issubclass(attr, BaseTimApi) and attr is not BaseTimApi:
                        instance = attr()
                        if instance.api_id:
                            custom_apis_by_id[instance.api_id] = instance
                            custom_apis_by_name[instance.name] = instance
                            if instance.service_name and instance.command:
                                custom_apis_by_full_cmd[f"v4/{instance.service_name}/{instance.command}"] = instance
            except Exception as e:
                print(f"[WARN] Failed to load module {full_module_name}: {e}")

        # 2. 读取官方全量 166 REST API 目录 (core/tim_full_catalog.json)
        catalog_path = os.path.join(os.path.dirname(__file__), "tim_full_catalog.json")
        ordered_list: List[BaseTimApi] = []
        used_custom_api_ids = set()

        if os.path.exists(catalog_path):
            with open(catalog_path, "r", encoding="utf-8") as f:
                catalog_data = json.load(f)

            for item in catalog_data:
                api_id = item.get("api_id")
                name = item.get("name")
                full_cmd = item.get("full_command")
                doc_id = item.get("doc_id")

                # 严格匹配已有自定义实现（避免跨服务重名 command 碰撞）
                matched_candidate = (
                    custom_apis_by_id.get(api_id) or
                    custom_apis_by_full_cmd.get(full_cmd) or
                    custom_apis_by_name.get(name)
                )

                if matched_candidate and matched_candidate.api_id not in used_custom_api_ids:
                    matched_custom = matched_candidate
                    used_custom_api_ids.add(matched_custom.api_id)
                    # 同步官方标准目录层级、名称与文档链接
                    matched_custom.name = item.get("name", matched_custom.name)
                    matched_custom.category = item.get("category", matched_custom.category)
                    matched_custom.subcategory = item.get("subcategory", matched_custom.subcategory)
                    matched_custom.path = item.get("path", [])
                    matched_custom.doc_id = doc_id
                    matched_custom.doc_url = item.get("doc_url", matched_custom.doc_url)
                    api_instance = matched_custom
                else:
                    api_instance = DynamicTimApi(item)

                # 注册
                self._apis[api_instance.api_id] = api_instance
                if api_id and api_id != api_instance.api_id:
                    self._apis[api_id] = api_instance
                if doc_id:
                    self._apis[f"tim_{doc_id}"] = api_instance
                ordered_list.append(api_instance)

        # 3. 注册其他未在 catalog 中的遗留类到 lookup map，但不污染官方 166 目录树
        for inst in custom_apis_by_id.values():
            if inst.api_id not in self._apis:
                self._apis[inst.api_id] = inst

        self._ordered_apis = ordered_list
        self._discovered = True

    def get_api(self, api_id: str) -> Optional[BaseTimApi]:
        self.discover()
        return self._apis.get(api_id)

    def list_apis(self) -> List[dict]:
        self.discover()
        return [api.to_metadata() for api in self._ordered_apis]

    def reload(self):
        self._discovered = False
        self._apis.clear()
        self._ordered_apis.clear()
        self.discover()


registry = ApiRegistry()
