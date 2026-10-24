# -*- coding: utf-8 -*-
"""
腾讯云 IM API 基类与字段定义
"""

import json
from typing import Any, Dict, List


class Field:
    def __init__(
        self,
        name: str,
        label: str,
        type: str = "string",  # string, number, boolean, json, list
        required: bool = True,
        default: Any = None,
        placeholder: str = "",
        help_text: str = "",
        aliases: List[str] = None  # 用于 Excel/CSV 自动列匹配
    ):
        self.name = name
        self.label = label
        self.type = type
        self.required = required
        self.default = default
        self.placeholder = placeholder
        self.help_text = help_text
        self.aliases = aliases or []

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "type": self.type,
            "required": self.required,
            "default": self.default,
            "placeholder": self.placeholder,
            "help_text": self.help_text,
            "aliases": self.aliases
        }


class BaseTimApi:
    api_id: str = ""
    name: str = ""
    category: str = "通用"
    subcategory: str = ""
    path: List[str] = []
    doc_id: int = 0
    service_name: str = ""
    command: str = ""
    doc_url: str = ""
    description: str = ""
    fields: List[Field] = []
    sample_payload: Dict[str, Any] = {}

    def build_payload(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据前端表单或批量行字典转换组装最终的 API 请求包体
        子类可按需覆盖此方法
        """
        payload = {}
        for f in self.fields:
            val = input_data.get(f.name)
            if val is None:
                # 检查别名
                for alias in f.aliases:
                    if alias in input_data and input_data[alias] is not None:
                        val = input_data[alias]
                        break

            if val is None:
                # 忽略大小写及下划线模糊匹配 (如 to_account -> To_Account)
                f_norm = f.name.lower().replace("_", "")
                for k, v in input_data.items():
                    if k.lower().replace("_", "") == f_norm and v is not None:
                        val = v
                        break

            if val is not None:
                if f.type == "number":
                    try:
                        if isinstance(val, (int, float)):
                            pass
                        elif isinstance(val, str) and val.strip() != "":
                            val = int(val) if val.strip().lstrip("-").isdigit() else (float(val) if "." in val else int(val))
                    except (ValueError, TypeError):
                        pass
                elif f.type == "boolean":
                    if isinstance(val, str):
                        val = val.lower() in ("true", "1", "yes")
                    else:
                        val = bool(val)
                elif f.type == "list":
                    if isinstance(val, str):
                        val_str = val.strip()
                        if val_str.startswith("[") and val_str.endswith("]"):
                            try:
                                val = json.loads(val_str)
                            except Exception:
                                val = [x.strip() for x in val_str[1:-1].split(",") if x.strip()]
                        elif val_str:
                            val = [x.strip() for x in val_str.split(",") if x.strip()]
                        else:
                            val = []
                elif f.type == "json":
                    if isinstance(val, str):
                        try:
                            val = json.loads(val)
                        except Exception:
                            pass
                payload[f.name] = val
            elif f.default is not None:
                payload[f.name] = f.default

        # 如果 input_data 本身已经包含 sample_payload 结构，直接合并未匹配字段
        for k, v in input_data.items():
            if k not in payload and not k.startswith("_"):
                payload[k] = v
        return payload

    def to_metadata(self) -> dict:
        full_cmd = (
            f"v4/{self.service_name}/{self.command}"
            if self.service_name and not self.command.startswith("v4/")
            else self.command
        )
        return {
            "api_id": self.api_id,
            "name": self.name,
            "category": self.category,
            "subcategory": self.subcategory or "常规",
            "path": getattr(self, "path", []) or ([self.category, self.subcategory] if self.subcategory else [self.category]),
            "doc_id": getattr(self, "doc_id", 0),
            "service_name": self.service_name,
            "command": full_cmd,
            "raw_command": self.command,
            "doc_url": self.doc_url,
            "description": self.description,
            "fields": [f.to_dict() for f in self.fields],
            "sample_payload": self.sample_payload
        }
