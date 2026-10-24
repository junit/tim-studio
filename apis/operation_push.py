# -*- coding: utf-8 -*-
"""
全局禁言管理、运营统计与全员推送 API
对应文档: https://cloud.tencent.com/document/product/269/1520#operation
"""

import random
from .base import BaseTimApi, Field


# ---------------- 全局禁言管理 ----------------
class SetNoSpeakingApi(BaseTimApi):
    api_id = "op_set_no_speaking"
    name = "设置全局禁言"
    category = "全局禁言与运营"
    subcategory = "全局禁言"
    service_name = "openconfigsvr"
    command = "setnospeaking"
    doc_url = "https://cloud.tencent.com/document/product/269/4230"
    description = "对某个帐号设置全应用范围内的单聊禁言和群聊禁言（单位秒，4294967295 为永久禁言，0 为解禁）"

    fields = [
        Field("Set_Account", "目标用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("C2CmsgNospeakingTime", "单聊禁言时间 (秒，0为解除)", type="number", required=False, default=3600),
        Field("GroupmsgNospeakingTime", "群聊禁言时间 (秒，0为解除)", type="number", required=False, default=3600)
    ]

    sample_payload = {
        "Set_Account": "user1",
        "C2CmsgNospeakingTime": 3600,
        "GroupmsgNospeakingTime": 3600
    }


class GetNoSpeakingApi(BaseTimApi):
    api_id = "op_get_no_speaking"
    name = "查询全局禁言"
    category = "全局禁言与运营"
    subcategory = "全局禁言"
    service_name = "openconfigsvr"
    command = "getnospeaking"
    doc_url = "https://cloud.tencent.com/document/product/269/4229"
    description = "查询指定帐号的全局单聊禁言和群聊禁言剩余时长"

    fields = [
        Field("Get_Account", "查询目标 UserID", type="string", required=True, placeholder="例如: user1")
    ]

    sample_payload = {
        "Get_Account": "user1"
    }


# ---------------- 运营与统计 ----------------
class GetAppInfoApi(BaseTimApi):
    api_id = "op_get_app_info"
    name = "拉取运营数据"
    category = "全局禁言与运营"
    subcategory = "运营管理"
    service_name = "openconfigsvr"
    command = "getappinfo"
    doc_url = "https://cloud.tencent.com/document/product/269/4142"
    description = "获取 App 的各项运营统计数据（注册用户数、活跃用户数、发消息量等）"

    fields = [
        Field("RequestField", "待查询的指标列表", type="list", required=False, default=[
            "Chain_Number", "Active_User_Num", "One_Way_Users", "Two_Way_Users"
        ])
    ]

    sample_payload = {
        "RequestField": [
            "Chain_Number",
            "Active_User_Num",
            "One_Way_Users",
            "Two_Way_Users"
        ]
    }


class GetHistoryApi(BaseTimApi):
    api_id = "op_get_history"
    name = "下载历史消息记录"
    category = "全局禁言与运营"
    subcategory = "运营管理"
    service_name = "open_msg_svc"
    command = "get_history"
    doc_url = "https://cloud.tencent.com/document/product/269/1650"
    description = "获取历史单聊或群聊消息压缩包的离线下载 URL（支持按小时维度下载）"

    fields = [
        Field("ChatType", "消息类型 (C2C: 单聊, Group: 群聊)", type="string", required=True, default="C2C"),
        Field("MsgTime", "查询时间 (格式形如 2026102314 表示某年某月某日某小时)", type="string", required=True, placeholder="YYYYMMDDHH")
    ]

    sample_payload = {
        "ChatType": "C2C",
        "MsgTime": "2026102314"
    }


class GetIPListApi(BaseTimApi):
    api_id = "op_get_ip_list"
    name = "获取服务器 IP 地址"
    category = "全局禁言与运营"
    subcategory = "运营管理"
    service_name = "ConfigSvc"
    command = "GetIPList"
    doc_url = "https://cloud.tencent.com/document/product/269/45438"
    description = "获取腾讯云 IM 服务端推送/回调所使用的出口公网 IP 清单（用于防火墙白名单配置）"

    fields = []

    sample_payload = {}


# ---------------- 全员推送 ----------------
class ImPushApi(BaseTimApi):
    api_id = "push_all_member"
    name = "全员推送广播"
    category = "全员推送"
    subcategory = "推送消息"
    service_name = "all_member_push"
    command = "im_push"
    doc_url = "https://cloud.tencent.com/document/product/269/45934"
    description = "支持向 App 全量注册用户下发全员系统广播推送"

    fields = [
        Field("From_Account", "发送方 UserID", type="string", required=False, default="admin"),
        Field("Text", "推送文本内容", type="string", required=True, placeholder="请输入推送内容")
    ]

    sample_payload = {
        "From_Account": "admin",
        "MsgRandom": 128912,
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "全员系统维护通知"}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            return {
                "From_Account": input_data.get("From_Account") or "admin",
                "MsgRandom": int(input_data.get("MsgRandom") or random.randint(100000, 999999)),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
            }
        if "MsgBody" in input_data:
            return input_data
        return {
            "From_Account": input_data.get("From_Account") or "admin",
            "MsgRandom": random.randint(100000, 999999),
            "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
        }


class ImSetAttrApi(BaseTimApi):
    api_id = "push_set_user_attr"
    name = "设置用户属性 (推送标签)"
    category = "全员推送"
    subcategory = "标签与属性"
    service_name = "all_member_push"
    command = "im_set_attr"
    doc_url = "https://cloud.tencent.com/document/product/269/45935"
    description = "为指定用户设置用于全员推送定向筛选的自定义用户属性"

    fields = [
        Field("To_Account", "目标用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("AttrKey", "属性名", type="string", required=True, placeholder="例如: city"),
        Field("AttrValue", "属性值", type="string", required=True, placeholder="例如: beijing")
    ]

    sample_payload = {
        "UserAttrs": [
            {
                "To_Account": "user1",
                "Attrs": {"city": "beijing"}
            }
        ]
    }

    def build_payload(self, input_data: dict) -> dict:
        if "UserAttrs" in input_data:
            return input_data
        return {
            "UserAttrs": [
                {
                    "To_Account": input_data.get("To_Account"),
                    "Attrs": {input_data.get("AttrKey", "tag"): input_data.get("AttrValue", "val")}
                }
            ]
        }


class ImAddTagApi(BaseTimApi):
    api_id = "push_add_tag"
    name = "添加用户标签"
    category = "全员推送"
    subcategory = "标签与属性"
    service_name = "all_member_push"
    command = "im_add_tag"
    doc_url = "https://cloud.tencent.com/document/product/269/45941"
    description = "为指定用户打上定向推送标签（如 VIP、游戏玩家）"

    fields = [
        Field("To_Account", "用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("Tags", "标签列表", type="list", required=True, placeholder="例如: vip,level10")
    ]

    sample_payload = {
        "UserTags": [
            {
                "To_Account": "user1",
                "Tags": ["vip", "level10"]
            }
        ]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("To_Account") or input_data.get("Tags"):
            tags = input_data.get("Tags", [])
            if isinstance(tags, str):
                tags = [x.strip() for x in tags.split(",") if x.strip()]
            return {
                "UserTags": [
                    {
                        "To_Account": input_data.get("To_Account"),
                        "Tags": tags
                    }
                ]
            }
        if "UserTags" in input_data:
            return input_data
        tags = input_data.get("Tags")
        if isinstance(tags, str):
            tags = [x.strip() for x in tags.split(",") if x.strip()]
        return {
            "UserTags": [
                {
                    "To_Account": input_data.get("To_Account"),
                    "Tags": tags
                }
            ]
        }
