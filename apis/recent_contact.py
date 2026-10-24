# -*- coding: utf-8 -*-
"""
最近联系人与会话管理 API
对应文档: https://cloud.tencent.com/document/product/269/1520#recent_contact
"""

from .base import BaseTimApi, Field


class GetRecentContactListApi(BaseTimApi):
    api_id = "recent_contact_get_list"
    name = "拉取会话列表"
    category = "最近联系人"
    subcategory = "会话列表与标记"
    service_name = "recentcontact"
    command = "get_list"
    doc_url = "https://cloud.tencent.com/document/product/269/62118"
    description = "分页拉取指定用户的最近会话（C2C 和群聊）列表"

    fields = [
        Field("From_Account", "查询方 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("TimeStamp", "分页时间戳 (初次填 0)", type="number", required=False, default=0),
        Field("StartIndex", "分页游标 (初次填 0)", type="number", required=False, default=0),
        Field("TopTimeStamp", "置顶时间戳 (初次填 0)", type="number", required=False, default=0),
        Field("TopStartIndex", "置顶游标 (初次填 0)", type="number", required=False, default=0),
        Field("AssistFlags", "辅助标志位 (填 0 即可)", type="number", required=False, default=0)
    ]

    sample_payload = {
        "From_Account": "user1",
        "TimeStamp": 0,
        "StartIndex": 0,
        "TopTimeStamp": 0,
        "TopStartIndex": 0,
        "AssistFlags": 0
    }


class DeleteRecentContactApi(BaseTimApi):
    api_id = "recent_contact_delete"
    name = "删除单个会话"
    category = "最近联系人"
    subcategory = "会话列表与标记"
    service_name = "recentcontact"
    command = "delete"
    doc_url = "https://cloud.tencent.com/document/product/269/62119"
    description = "删除指定用户的某条最近会话记录（不清除消息漫游记录）"

    fields = [
        Field("From_Account", "操作用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("Type", "会话类型 (1: C2C 单聊, 2: Group 群聊)", type="number", required=True, default=1),
        Field("To_Account", "单聊对端账号 (如果是单聊必填)", type="string", required=False, placeholder="例如: user2"),
        Field("ToGroupid", "群组 ID (如果是群聊必填)", type="string", required=False, placeholder="例如: @TGS#123"),
        Field("ClearRamble", "是否同时清空漫游消息 (0: 否, 1: 是)", type="number", required=False, default=0)
    ]

    sample_payload = {
        "From_Account": "user1",
        "Type": 1,
        "To_Account": "user2",
        "ClearRamble": 0
    }


class MarkContactApi(BaseTimApi):
    api_id = "recent_contact_mark"
    name = "标记会话 (置顶/免打扰)"
    category = "最近联系人"
    subcategory = "会话列表与标记"
    service_name = "recentcontact"
    command = "mark_contact"
    doc_url = "https://cloud.tencent.com/document/product/269/84824"
    description = "支持对指定会话设置置顶、免打扰或折叠状态标记"

    fields = [
        Field("From_Account", "操作用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("Type", "会话类型 (1: C2C 单聊, 2: Group 群聊)", type="number", required=True, default=1),
        Field("To_Account", "单聊对端账号 (单聊填)", type="string", required=False, placeholder="例如: user2"),
        Field("ToGroupid", "群组 ID (群聊填)", type="string", required=False, placeholder="例如: @TGS#123"),
        Field("MarkType", "标记类型 (1: 置顶, 2: 折叠, 3: 隐藏)", type="number", required=True, default=1),
        Field("MarkAction", "标记动作 (1: 设置, 0: 取消)", type="number", required=True, default=1)
    ]

    sample_payload = {
        "From_Account": "user1",
        "Type": 1,
        "To_Account": "user2",
        "MarkType": 1,
        "MarkAction": 1
    }
