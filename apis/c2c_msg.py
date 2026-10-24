# -*- coding: utf-8 -*-
"""
单聊消息相关 API
对应文档: https://cloud.tencent.com/document/product/269/1520#c2c
"""

import random
from .base import BaseTimApi, Field


class AdminMsgWithdrawApi(BaseTimApi):
    api_id = "c2c_msg_withdraw"
    name = "撤回单聊消息"
    category = "单聊消息"
    subcategory = "消息收发与撤回"
    service_name = "openim"
    command = "admin_msgwithdraw"
    doc_url = "https://cloud.tencent.com/document/product/269/38980"
    description = "管理员撤回指定单聊消息，无时间限制（漫游期内），必须提供 MsgKey"

    fields = [
        Field("From_Account", "发送方 UserID", type="string", required=True, placeholder="例如: user1", aliases=["from_account", "sender"]),
        Field("To_Account", "接收方 UserID", type="string", required=True, placeholder="例如: user2", aliases=["to_account", "receiver"]),
        Field("MsgKey", "消息唯一标识 (MsgKey)", type="string", required=True, placeholder="例如: 3190_12345678_1700000000", aliases=["msg_key", "MsgKey"])
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": "user2",
        "MsgKey": "3190_12345678_1700000000"
    }


class SendMsgApi(BaseTimApi):
    api_id = "c2c_send_msg"
    name = "单发单聊消息"
    category = "单聊消息"
    subcategory = "消息收发与撤回"
    service_name = "openim"
    command = "sendmsg"
    doc_url = "https://cloud.tencent.com/document/product/269/2282"
    description = "管理员向指定用户单发一条单聊文本或自定义消息"

    fields = [
        Field("From_Account", "发送方 UserID", type="string", required=True, placeholder="例如: admin", aliases=["from_account"]),
        Field("To_Account", "接收方 UserID", type="string", required=True, placeholder="例如: user1", aliases=["to_account"]),
        Field("Text", "文本消息内容", type="string", required=True, placeholder="请输入要发送的文本内容", aliases=["text", "content"])
    ]

    sample_payload = {
        "SyncOtherMachine": 1,
        "From_Account": "admin",
        "To_Account": "user1",
        "MsgRandom": 123456,
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "您好，这是系统通知消息。"}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            from_acc = input_data.get("From_Account", "")
            to_acc = input_data.get("To_Account", "")
            text = input_data.get("Text", "")
            return {
                "SyncOtherMachine": int(input_data.get("SyncOtherMachine", 1)),
                "From_Account": str(from_acc),
                "To_Account": str(to_acc),
                "MsgRandom": int(input_data.get("MsgRandom") or random.randint(100000, 999999)),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": text}}]
            }
        if "MsgBody" in input_data:
            return input_data
        from_acc = input_data.get("From_Account", "")
        to_acc = input_data.get("To_Account", "")
        text = input_data.get("Text", "")
        return {
            "SyncOtherMachine": 1,
            "From_Account": from_acc,
            "To_Account": to_acc,
            "MsgRandom": random.randint(100000, 999999),
            "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": text}}]
        }


class BatchSendMsgApi(BaseTimApi):
    api_id = "c2c_batch_send_msg"
    name = "批量发单聊消息"
    category = "单聊消息"
    subcategory = "消息收发与撤回"
    service_name = "openim"
    command = "batchsendmsg"
    doc_url = "https://cloud.tencent.com/document/product/269/1612"
    description = "支持单次向最多 500 个用户发送同一条消息"

    fields = [
        Field("To_Account", "接收方 UserID 列表", type="list", required=True, placeholder="例如: user1,user2", aliases=["to_accounts"]),
        Field("Text", "文本消息内容", type="string", required=True, placeholder="请输入群发文本", aliases=["text"])
    ]

    sample_payload = {
        "SyncOtherMachine": 2,
        "To_Account": ["user1", "user2"],
        "MsgRandom": 123456,
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "全员系统通知测试"}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            to_acc = input_data.get("To_Account", [])
            if isinstance(to_acc, str):
                to_acc = [x.strip() for x in to_acc.split(",") if x.strip()]
            text = input_data.get("Text", "")
            return {
                "SyncOtherMachine": int(input_data.get("SyncOtherMachine", 2)),
                "To_Account": to_acc,
                "MsgRandom": int(input_data.get("MsgRandom") or random.randint(100000, 999999)),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": text}}]
            }
        if "MsgBody" in input_data:
            return input_data
        to_acc = input_data.get("To_Account", [])
        if isinstance(to_acc, str):
            to_acc = [x.strip() for x in to_acc.split(",") if x.strip()]
        text = input_data.get("Text", "")
        return {
            "SyncOtherMachine": 2,
            "To_Account": to_acc,
            "MsgRandom": random.randint(100000, 999999),
            "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": text}}]
        }


class ImportMsgApi(BaseTimApi):
    api_id = "c2c_import_msg"
    name = "导入单聊消息"
    category = "单聊消息"
    subcategory = "消息收发与撤回"
    service_name = "openim"
    command = "importmsg"
    doc_url = "https://cloud.tencent.com/document/product/269/2568"
    description = "将外部历史聊天记录按时间导入腾讯云 IM 系统中"

    fields = [
        Field("From_Account", "发送方 UserID", type="string", required=True),
        Field("To_Account", "接收方 UserID", type="string", required=True),
        Field("MsgRandom", "消息随机数", type="number", required=True, default=123456),
        Field("MsgTimeStamp", "消息发送时间戳 (秒)", type="number", required=True),
        Field("Text", "消息文本", type="string", required=True)
    ]

    sample_payload = {
        "SyncFromOldSystem": 1,
        "From_Account": "user1",
        "To_Account": "user2",
        "MsgRandom": 123456,
        "MsgTimeStamp": 1557387418,
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "历史消息迁移"}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            return {
                "SyncFromOldSystem": int(input_data.get("SyncFromOldSystem", 1)),
                "From_Account": str(input_data.get("From_Account", "")),
                "To_Account": str(input_data.get("To_Account", "")),
                "MsgRandom": int(input_data.get("MsgRandom") or random.randint(100000, 999999)),
                "MsgTimeStamp": int(input_data.get("MsgTimeStamp") or 1557387418),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
            }
        if "MsgBody" in input_data:
            return input_data
        return input_data


class AdminGetRoamMsgApi(BaseTimApi):
    api_id = "c2c_get_roam_msg"
    name = "查询单聊历史消息"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "admin_getroammsg"
    doc_url = "https://cloud.tencent.com/document/product/269/38982"
    description = "管理员拉取两个用户之间的历史漫游消息记录，可用于排查、审计或检索 MsgKey"

    fields = [
        Field("From_Account", "会话方 A (UserID)", type="string", required=True, placeholder="例如: user1"),
        Field("To_Account", "会话方 B (UserID)", type="string", required=True, placeholder="例如: user2"),
        Field("MaxCnt", "拉取数量 (1-100)", type="number", required=True, default=20),
        Field("MinTime", "起始时间戳 (秒)", type="number", required=False, default=0),
        Field("MaxTime", "结束时间戳 (秒)", type="number", required=False, default=0)
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": "user2",
        "MaxCnt": 20,
        "MinTime": 0,
        "MaxTime": 0
    }


class AdminSetMsgReadApi(BaseTimApi):
    api_id = "c2c_set_msg_read"
    name = "设置单聊消息已读"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "admin_set_msg_read"
    doc_url = "https://cloud.tencent.com/document/product/269/50349"
    description = "设置单聊会话中某一方发送的消息为已读状态"

    fields = [
        Field("Report_Account", "进行已读上报的用户", type="string", required=True, placeholder="例如: user1"),
        Field("Peer_Account", "单聊的对端用户", type="string", required=True, placeholder="例如: user2")
    ]

    sample_payload = {
        "Report_Account": "user1",
        "Peer_Account": "user2"
    }


class GetC2cUnreadMsgNumApi(BaseTimApi):
    api_id = "c2c_get_unread_num"
    name = "查询单聊未读消息计数"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "get_c2c_unread_msg_num"
    doc_url = "https://cloud.tencent.com/document/product/269/56485"
    description = "获取用户单聊会话中未读消息的数量"

    fields = [
        Field("To_Account", "待查询的用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("Peer_Account", "单聊对端账号列表 (留空查全部)", type="list", required=False, default=[])
    ]

    sample_payload = {
        "To_Account": "user1",
        "Peer_Account": ["user2"]
    }


class ModifyC2cMsgApi(BaseTimApi):
    api_id = "c2c_modify_msg"
    name = "修改单聊历史消息"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "modify_c2c_msg"
    doc_url = "https://cloud.tencent.com/document/product/269/65306"
    description = "修改已经发送的历史单聊消息内容，需提供 MsgKey"

    fields = [
        Field("From_Account", "发送方 UserID", type="string", required=True),
        Field("To_Account", "接收方 UserID", type="string", required=True),
        Field("MsgKey", "待修改消息的 MsgKey", type="string", required=True),
        Field("NewText", "新消息文本", type="string", required=True)
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": "user2",
        "MsgKey": "31364_283462_1511347623",
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "修改后的消息内容"}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("NewText"):
            return {
                "From_Account": input_data.get("From_Account"),
                "To_Account": input_data.get("To_Account"),
                "MsgKey": input_data.get("MsgKey"),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("NewText", "")}}]
            }
        if "MsgBody" in input_data:
            return input_data
        return {
            "From_Account": input_data.get("From_Account"),
            "To_Account": input_data.get("To_Account"),
            "MsgKey": input_data.get("MsgKey"),
            "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("NewText", "")}}]
        }


class GetKeyValuesApi(BaseTimApi):
    api_id = "c2c_get_key_values"
    name = "拉取单聊消息扩展"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "get_key_values"
    doc_url = "https://cloud.tencent.com/document/product/269/67586"
    description = "拉取单聊消息的自定义 Key-Value 扩展信息"

    fields = [
        Field("MsgKey", "消息唯一标识 MsgKey", type="string", required=True)
    ]

    sample_payload = {
        "MsgKey": "31364_283462_1511347623"
    }


class SetKeyValuesApi(BaseTimApi):
    api_id = "c2c_set_key_values"
    name = "设置单聊消息扩展"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "set_key_values"
    doc_url = "https://cloud.tencent.com/document/product/269/67587"
    description = "为指定单聊消息设置自定义 Key-Value 扩展"

    fields = [
        Field("MsgKey", "消息唯一标识 MsgKey", type="string", required=True),
        Field("Key", "扩展键名", type="string", required=True, default="custom_tag"),
        Field("Value", "扩展键值", type="string", required=True, default="approved")
    ]

    sample_payload = {
        "MsgKey": "31364_283462_1511347623",
        "ExtensionList": [{"Key": "custom_tag", "Value": "approved"}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Key") or input_data.get("Value"):
            return {
                "MsgKey": input_data.get("MsgKey"),
                "ExtensionList": [{"Key": input_data.get("Key", "tag"), "Value": input_data.get("Value", "1")}]
            }
        if "ExtensionList" in input_data:
            return input_data
        return {
            "MsgKey": input_data.get("MsgKey"),
            "ExtensionList": [{"Key": input_data.get("Key", "tag"), "Value": input_data.get("Value", "1")}]
        }


class DeleteC2cMsgRambleApi(BaseTimApi):
    api_id = "c2c_delete_ramble"
    name = "清空单聊漫游消息"
    category = "单聊消息"
    subcategory = "消息状态与漫游"
    service_name = "openim"
    command = "delete_c2c_msg_ramble"
    doc_url = "https://cloud.tencent.com/document/product/269/71578"
    description = "清空指定单聊会话中双方或单方的云端历史漫游消息"

    fields = [
        Field("From_Account", "会话发起方 UserID", type="string", required=True),
        Field("To_Account", "会话目标方 UserID", type="string", required=True)
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": "user2"
    }
