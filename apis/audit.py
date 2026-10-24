# -*- coding: utf-8 -*-
"""
内容安全审核 API
对应文档: https://cloud.tencent.com/document/product/269/1520#audit
"""

from .base import BaseTimApi, Field


class ContentModerationApi(BaseTimApi):
    api_id = "audit_content_moderation"
    name = "文本内容安全审核"
    category = "内容安全与审核"
    subcategory = "内容审核"
    service_name = "openim_moderation_http_svc"
    command = "content_moderation"
    doc_url = "https://cloud.tencent.com/document/product/269/84825"
    description = "提交单条文本进行涉黄、涉政、暴恐、违禁等多维度机审检测"

    fields = [
        Field("Text", "待检测文本内容", type="string", required=True, placeholder="请输入需要机审的文本"),
        Field("User_Account", "发送者 UserID (可选)", type="string", required=False, default="")
    ]

    sample_payload = {
        "Content": "待检测文本样例"
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            return {
                "Content": input_data.get("Text", ""),
                "User_Account": input_data.get("User_Account", "")
            }
        if "Content" in input_data:
            return input_data
        return {
            "Content": input_data.get("Text", ""),
            "User_Account": input_data.get("User_Account", "")
        }


class AddLocalAuditKeywordsApi(BaseTimApi):
    api_id = "audit_add_keywords"
    name = "添加自定义敏感词"
    category = "内容安全与审核"
    subcategory = "词库管理"
    service_name = "openim_moderation_http_svc"
    command = "add_local_audit_keywords"
    doc_url = "https://cloud.tencent.com/document/product/269/84828"
    description = "向 App 自定义本地敏感词库中添加关键词"

    fields = [
        Field("Keywords", "敏感词列表", type="list", required=True, placeholder="例如: 违禁词A,违禁词B")
    ]

    sample_payload = {
        "Keywords": ["违禁词A", "违禁词B"]
    }


class GetLocalAuditKeywordsApi(BaseTimApi):
    api_id = "audit_get_keywords"
    name = "查询自定义敏感词库"
    category = "内容安全与审核"
    subcategory = "词库管理"
    service_name = "openim_moderation_http_svc"
    command = "get_local_audit_keywords"
    doc_url = "https://cloud.tencent.com/document/product/269/84830"
    description = "查询当前已配置的本地敏感词库清单"

    fields = []

    sample_payload = {}
