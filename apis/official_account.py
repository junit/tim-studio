# -*- coding: utf-8 -*-
"""
公众号管理 API
对应文档: https://cloud.tencent.com/document/product/269/1520#official
"""

import random
from .base import BaseTimApi, Field


class CreateOfficialAccountApi(BaseTimApi):
    api_id = "official_create"
    name = "创建公众号"
    category = "公众号管理"
    subcategory = "公众号管理"
    service_name = "official_account_open_http_svc"
    command = "create_official_account"
    doc_url = "https://cloud.tencent.com/document/product/269/96310"
    description = "创建一个用于向订阅用户单向推送图文消息与资讯的公众号"

    fields = [
        Field("Owner_Account", "公众号拥有者 UserID", type="string", required=True, placeholder="例如: admin"),
        Field("Name", "公众号名称", type="string", required=True, placeholder="例如: 官方早报"),
        Field("Introduction", "公众号简介", type="string", required=False, default=""),
        Field("FaceUrl", "头像 URL", type="string", required=False, default="")
    ]

    sample_payload = {
        "Owner_Account": "admin",
        "Name": "官方资讯号",
        "Introduction": "第一时间发布产品动态"
    }


class DestroyOfficialAccountApi(BaseTimApi):
    api_id = "official_destroy"
    name = "解散公众号"
    category = "公众号管理"
    subcategory = "公众号管理"
    service_name = "official_account_open_http_svc"
    command = "destroy_official_account"
    doc_url = "https://cloud.tencent.com/document/product/269/96311"
    description = "注销并解散指定的公众号"

    fields = [
        Field("Official_Account", "公众号 ID", type="string", required=True, placeholder="例如: @official#123")
    ]

    sample_payload = {
        "Official_Account": "@official#123"
    }


class SendOfficialAccountMsgApi(BaseTimApi):
    api_id = "official_send_msg"
    name = "发送公众号消息"
    category = "公众号管理"
    subcategory = "公众号管理"
    service_name = "official_account_open_http_svc"
    command = "send_official_account_msg"
    doc_url = "https://cloud.tencent.com/document/product/269/96313"
    description = "向公众号的所有订阅用户广播下发消息"

    fields = [
        Field("Official_Account", "公众号 ID", type="string", required=True, placeholder="例如: @official#123"),
        Field("Text", "消息文本内容", type="string", required=True, placeholder="请输入要推送的内容")
    ]

    sample_payload = {
        "Official_Account": "@official#123",
        "Random": 182736,
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "今日重点行情回顾..."}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            return {
                "Official_Account": input_data.get("Official_Account"),
                "Random": int(input_data.get("Random") or random.randint(100000, 999999)),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
            }
        if "MsgBody" in input_data:
            return input_data
        return {
            "Official_Account": input_data.get("Official_Account"),
            "Random": random.randint(100000, 999999),
            "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
        }


class OfficialAccountMsgRecallApi(BaseTimApi):
    api_id = "official_msg_recall"
    name = "撤回公众号消息"
    category = "公众号管理"
    subcategory = "公众号管理"
    service_name = "official_account_open_http_svc"
    command = "official_account_msg_recall"
    doc_url = "https://cloud.tencent.com/document/product/269/96315"
    description = "撤回指定公众号已发布的历史消息"

    fields = [
        Field("Official_Account", "公众号 ID", type="string", required=True, placeholder="例如: @official#123"),
        Field("MsgSeq", "消息序列号 MsgSeq", type="number", required=True)
    ]

    sample_payload = {
        "Official_Account": "@official#123",
        "MsgSeq": 1002
    }


class AddSubscriberApi(BaseTimApi):
    api_id = "official_add_subscriber"
    name = "添加公众号订阅者"
    category = "公众号管理"
    subcategory = "公众号管理"
    service_name = "official_account_open_http_svc"
    command = "add_subscriber"
    doc_url = "https://cloud.tencent.com/document/product/269/96316"
    description = "将指定用户添加到公众号的关注/订阅列表中"

    fields = [
        Field("Official_Account", "公众号 ID", type="string", required=True, placeholder="例如: @official#123"),
        Field("Subscriber_Accounts", "订阅用户 UserID 列表", type="list", required=True, placeholder="例如: user1,user2")
    ]

    sample_payload = {
        "Official_Account": "@official#123",
        "Subscriber_Accounts": ["user1", "user2"]
    }
