# -*- coding: utf-8 -*-
"""
群组管理相关 API
对应文档: https://cloud.tencent.com/document/product/269/1520#group
"""

import random
from .base import BaseTimApi, Field, safe_int


# ---------------- 群基础资料 ----------------
class GetAppidGroupListApi(BaseTimApi):
    api_id = "group_get_appid_list"
    name = "获取 App 中的所有群组"
    category = "群组管理"
    subcategory = "群基础资料"
    service_name = "group_open_http_svc"
    command = "get_appid_group_list"
    doc_url = "https://cloud.tencent.com/document/product/269/1614"
    description = "分页拉取 App 当前创建的所有群组 ID"

    fields = [
        Field("Limit", "拉取数量上限 (最大 10000)", type="number", required=False, default=100),
        Field("Next", "分页拉取标志 (初次填 0)", type="number", required=False, default=0),
        Field("GroupType", "过滤群类型 (Public/Private/ChatRoom/AVChatRoom/Community)", type="string", required=False, default="")
    ]

    sample_payload = {
        "Limit": 100,
        "Next": 0
    }


class CreateGroupApi(BaseTimApi):
    api_id = "group_create"
    name = "创建群组"
    category = "群组管理"
    subcategory = "群基础资料"
    service_name = "group_open_http_svc"
    command = "create_group"
    doc_url = "https://cloud.tencent.com/document/product/269/1615"
    description = "管理员在服务端创建一个新群组"

    fields = [
        Field("Owner_Account", "群主 UserID", type="string", required=False, placeholder="例如: admin"),
        Field("Type", "群组类型 (Public/Private/ChatRoom/AVChatRoom/Community)", type="string", required=True, default="Public"),
        Field("Name", "群名称", type="string", required=True, placeholder="例如: 官方交流群"),
        Field("Introduction", "群简介", type="string", required=False, default=""),
        Field("Notification", "群公告", type="string", required=False, default="")
    ]

    sample_payload = {
        "Owner_Account": "admin",
        "Type": "Public",
        "Name": "测试交流群",
        "Introduction": "交流群介绍",
        "Notification": "群公告内容"
    }


class GetGroupInfoApi(BaseTimApi):
    api_id = "group_get_info"
    name = "获取群详细资料"
    category = "群组管理"
    subcategory = "群基础资料"
    service_name = "group_open_http_svc"
    command = "get_group_info"
    doc_url = "https://cloud.tencent.com/document/product/269/1616"
    description = "批量查询指定群组的详细基础资料（最多支持 100 个群）"

    fields = [
        Field("GroupIdList", "群 ID 列表", type="list", required=True, placeholder="例如: @TGS#123,@TGS#456", aliases=["group_id", "GroupId"])
    ]

    sample_payload = {
        "GroupIdList": ["@TGS#123"]
    }

    def build_payload(self, input_data: dict) -> dict:
        gids = input_data.get("GroupIdList")
        if isinstance(gids, str):
            gids = [x.strip() for x in gids.split(",") if x.strip()]
        return {"GroupIdList": gids}


class ModifyGroupBaseInfoApi(BaseTimApi):
    api_id = "group_modify_base_info"
    name = "修改群基础资料"
    category = "群组管理"
    subcategory = "群基础资料"
    service_name = "group_open_http_svc"
    command = "modify_group_base_info"
    doc_url = "https://cloud.tencent.com/document/product/269/1620"
    description = "管理员修改指定群组的名称、公告、简介等信息"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("Name", "新群名称", type="string", required=False),
        Field("Introduction", "新群简介", type="string", required=False),
        Field("Notification", "新群公告", type="string", required=False)
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Name": "全新官方交流群",
        "Notification": "请遵守群内交流规范"
    }


class DestroyGroupApi(BaseTimApi):
    api_id = "group_destroy"
    name = "解散群组"
    category = "群组管理"
    subcategory = "群基础资料"
    service_name = "group_open_http_svc"
    command = "destroy_group"
    doc_url = "https://cloud.tencent.com/document/product/269/1624"
    description = "管理员强制解散指定的群组"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123", aliases=["group_id", "GroupId"])
    ]

    sample_payload = {
        "GroupId": "@TGS#123"
    }


class ChangeGroupOwnerApi(BaseTimApi):
    api_id = "group_change_owner"
    name = "转让群主"
    category = "群组管理"
    subcategory = "群基础资料"
    service_name = "group_open_http_svc"
    command = "change_group_owner"
    doc_url = "https://cloud.tencent.com/document/product/269/1633"
    description = "将指定群的群主转让给另一位已有群成员"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("NewOwner_Account", "新群主 UserID", type="string", required=True, placeholder="例如: user_new_owner")
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "NewOwner_Account": "user_new_owner"
    }


# ---------------- 群成员管理 ----------------
class GetGroupMemberInfoApi(BaseTimApi):
    api_id = "group_get_member_info"
    name = "获取群成员详细资料"
    category = "群组管理"
    subcategory = "群成员管理"
    service_name = "group_open_http_svc"
    command = "get_group_member_info"
    doc_url = "https://cloud.tencent.com/document/product/269/1617"
    description = "分页拉取指定群的群成员列表及身份、入群时间等信息"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("Limit", "拉取数量上限 (最大 100)", type="number", required=False, default=50),
        Field("Offset", "偏移量 (初次填 0)", type="number", required=False, default=0)
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Limit": 50,
        "Offset": 0
    }


class AddGroupMemberApi(BaseTimApi):
    api_id = "group_add_member"
    name = "增加群成员"
    category = "群组管理"
    subcategory = "群成员管理"
    service_name = "group_open_http_svc"
    command = "add_group_member"
    doc_url = "https://cloud.tencent.com/document/product/269/1621"
    description = "向群组中批量添加成员（单次最多 500 人）"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("Member_Accounts", "待加入成员 UserID 列表", type="list", required=True, placeholder="例如: user1,user2"),
        Field("Silence", "是否静默加群 (0: 发通知, 1: 不发通知)", type="number", required=False, default=0)
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Silence": 1,
        "MemberList": [{"Member_Account": "user1"}, {"Member_Account": "user2"}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Member_Accounts"):
            accs = input_data.get("Member_Accounts", [])
            if isinstance(accs, str):
                accs = [x.strip() for x in accs.split(",") if x.strip()]
            return {
                "GroupId": input_data.get("GroupId"),
                "Silence": safe_int(input_data.get("Silence"), 0),
                "MemberList": [{"Member_Account": u} for u in accs]
            }
        if "MemberList" in input_data:
            return input_data
        accs = input_data.get("Member_Accounts", [])
        if isinstance(accs, str):
            accs = [x.strip() for x in accs.split(",") if x.strip()]
        return {
            "GroupId": input_data.get("GroupId"),
            "Silence": safe_int(input_data.get("Silence"), 0),
            "MemberList": [{"Member_Account": u} for u in accs]
        }


class DeleteGroupMemberApi(BaseTimApi):
    api_id = "group_delete_member"
    name = "删除群成员 (踢人)"
    category = "群组管理"
    subcategory = "群成员管理"
    service_name = "group_open_http_svc"
    command = "delete_group_member"
    doc_url = "https://cloud.tencent.com/document/product/269/1622"
    description = "将指定成员从群组中移出"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("MemberToDel_Account", "待移出成员 UserID 列表", type="list", required=True, placeholder="例如: user1,user2"),
        Field("Reason", "移出原因", type="string", required=False, default="违规踢出")
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "MemberToDel_Account": ["user1", "user2"],
        "Reason": "违规踢出"
    }


class ModifyAdminApi(BaseTimApi):
    api_id = "group_modify_admin"
    name = "设置/取消群管理员"
    category = "群组管理"
    subcategory = "群成员管理"
    service_name = "group_open_http_svc"
    command = "modify_admin"
    doc_url = "https://cloud.tencent.com/document/product/269/65303"
    description = "设置或取消指定成员的群管理员身份"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("Member_Account", "目标成员 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("Role", "身份 (Admin 为管理员, Member 为普通成员)", type="string", required=True, default="Admin")
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Member_Account": "user1",
        "Role": "Admin"
    }


class GetJoinedGroupListApi(BaseTimApi):
    api_id = "group_get_joined_list"
    name = "获取用户所加入的群组"
    category = "群组管理"
    subcategory = "群成员管理"
    service_name = "group_open_http_svc"
    command = "get_joined_group_list"
    doc_url = "https://cloud.tencent.com/document/product/269/1625"
    description = "查询指定用户当前加入的所有群组列表"

    fields = [
        Field("Member_Account", "用户 UserID", type="string", required=True, placeholder="例如: user1")
    ]

    sample_payload = {
        "Member_Account": "user1"
    }


class GetOnlineMemberNumApi(BaseTimApi):
    api_id = "group_get_online_member_num"
    name = "获取直播群在线人数"
    category = "群组管理"
    subcategory = "群成员管理"
    service_name = "group_open_http_svc"
    command = "get_online_member_num"
    doc_url = "https://cloud.tencent.com/document/product/269/49180"
    description = "拉取音视频聊天室 (AVChatRoom) 的当前实时在线人数"

    fields = [
        Field("GroupId", "直播群 ID", type="string", required=True, placeholder="例如: @TGS#a123")
    ]

    sample_payload = {
        "GroupId": "@TGS#a123"
    }


# ---------------- 群消息与撤回 ----------------
class GroupMsgRecallApi(BaseTimApi):
    api_id = "group_msg_recall"
    name = "撤回群聊消息"
    category = "群组管理"
    subcategory = "群消息管理"
    service_name = "group_open_http_svc"
    command = "group_msg_recall"
    doc_url = "https://cloud.tencent.com/document/product/269/1629"
    description = "管理员撤回群组中的指定消息，需提供群 ID 和消息 Seq"

    fields = [
        Field("GroupId", "群组 ID", type="string", required=True, placeholder="例如: @TGS#2J4SDFK3", aliases=["group_id", "GroupId"]),
        Field("MsgSeq", "消息序列号 (MsgSeq)", type="number", required=True, placeholder="例如: 12345", aliases=["msg_seq", "MsgSeq"])
    ]

    sample_payload = {
        "GroupId": "@TGS#2J4SDFK3",
        "MsgSeqList": [{"MsgSeq": 12345}]
    }

    def build_payload(self, input_data: dict) -> dict:
        group_id = input_data.get("GroupId") or input_data.get("group_id")
        msg_seq = input_data.get("MsgSeq") if input_data.get("MsgSeq") is not None else input_data.get("msg_seq")
        if msg_seq is not None and group_id is not None:
            return {
                "GroupId": str(group_id),
                "MsgSeqList": [{"MsgSeq": safe_int(msg_seq, 0)}]
            }
        if "MsgSeqList" in input_data:
            return input_data
        return {
            "GroupId": str(group_id) if group_id is not None else "",
            "MsgSeqList": [{"MsgSeq": safe_int(msg_seq, 0)}] if msg_seq is not None else []
        }


class SendGroupMsgApi(BaseTimApi):
    api_id = "group_send_msg"
    name = "在群组中发送普通消息"
    category = "群组管理"
    subcategory = "群消息管理"
    service_name = "group_open_http_svc"
    command = "send_group_msg"
    doc_url = "https://cloud.tencent.com/document/product/269/1629"
    description = "管理员代发群消息给群内所有成员"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("From_Account", "指定发送者 UserID (可选)", type="string", required=False, default=""),
        Field("Text", "文本消息内容", type="string", required=True, placeholder="输入发送到群内的文本")
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Random": 891273,
        "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": "管理员群通知"}}]
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("Text"):
            payload = {
                "GroupId": input_data.get("GroupId"),
                "Random": safe_int(input_data.get("Random")) or random.randint(100000, 999999),
                "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
            }
            if input_data.get("From_Account"):
                payload["From_Account"] = input_data.get("From_Account")
            return payload
        if "MsgBody" in input_data:
            return input_data
        payload = {
            "GroupId": input_data.get("GroupId"),
            "Random": random.randint(100000, 999999),
            "MsgBody": [{"MsgType": "TIMTextElem", "MsgContent": {"Text": input_data.get("Text", "")}}]
        }
        if input_data.get("From_Account"):
            payload["From_Account"] = input_data.get("From_Account")
        return payload


class SendGroupSystemNotificationApi(BaseTimApi):
    api_id = "group_send_sys_notification"
    name = "在群组中发送系统通知"
    category = "群组管理"
    subcategory = "群消息管理"
    service_name = "group_open_http_svc"
    command = "send_group_system_notification"
    doc_url = "https://cloud.tencent.com/document/product/269/1630"
    description = "向群组中发送官方系统级通知，无需指派发送者"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("Content", "系统通知文本内容", type="string", required=True, placeholder="输入系统通知")
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Content": "群组系统公告：今晚 22:00 进行维护。"
    }


class GroupMsgGetSimpleApi(BaseTimApi):
    api_id = "group_get_history_msg"
    name = "拉取群历史消息"
    category = "群组管理"
    subcategory = "群消息管理"
    service_name = "group_open_http_svc"
    command = "group_msg_get_simple"
    doc_url = "https://cloud.tencent.com/document/product/269/2738"
    description = "拉取指定群的历史漫游消息记录"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("ReqMsgNumber", "拉取数量 (1-20)", type="number", required=True, default=20),
        Field("ReqMsgSeq", "起始序列号 (留空或不填从最新拉取)", type="number", required=False)
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "ReqMsgNumber": 20
    }


class DeleteGroupMsgBySenderApi(BaseTimApi):
    api_id = "group_delete_msg_by_sender"
    name = "删除指定用户发送的群消息"
    category = "群组管理"
    subcategory = "群消息管理"
    service_name = "group_open_http_svc"
    command = "delete_group_msg_by_sender"
    doc_url = "https://cloud.tencent.com/document/product/269/2359"
    description = "一键撤回/清空群内某个违规用户发送的所有历史消息"

    fields = [
        Field("GroupId", "群 ID", type="string", required=True, placeholder="例如: @TGS#123"),
        Field("Sender_Account", "待清空消息的违规用户 UserID", type="string", required=True, placeholder="例如: bad_user")
    ]

    sample_payload = {
        "GroupId": "@TGS#123",
        "Sender_Account": "bad_user"
    }


# ---------------- 群禁言管理 ----------------
class ForbidSendMsgApi(BaseTimApi):
    api_id = "group_forbid_send_msg"
    name = "批量禁言和取消禁言"
    category = "群组管理"
    subcategory = "群禁言控制"
    service_name = "group_open_http_svc"
    command = "forbid_send_msg"
    doc_url = "https://cloud.tencent.com/document/product/269/1627"
    description = "设置或解除群成员的发言权限（禁言时间单位：秒，为 0 表示解除禁言）"

    fields = [
        Field("GroupId", "群组 ID", type="string", required=True, placeholder="例如: @TGS#2J4SDFK3"),
        Field("Members_Account", "成员 UserID 列表", type="list", required=True, placeholder="多个以逗号隔开，如 user1,user2"),
        Field("ShutUpTime", "禁言时长 (秒，0 为解除)", type="number", required=True, default=3600)
    ]

    sample_payload = {
        "GroupId": "@TGS#2J4SDFK3",
        "Members_Account": ["user1", "user2"],
        "ShutUpTime": 3600
    }


class GetGroupMutedAccountApi(BaseTimApi):
    api_id = "group_get_muted_account"
    name = "获取群组被禁言用户列表"
    category = "群组管理"
    subcategory = "群禁言控制"
    service_name = "group_open_http_svc"
    command = "get_group_muted_account"
    doc_url = "https://cloud.tencent.com/document/product/269/2925"
    description = "获取指定群组中当前所有被禁言的成员列表"

    fields = [
        Field("GroupId", "群组 ID", type="string", required=True, placeholder="例如: @TGS#123")
    ]

    sample_payload = {
        "GroupId": "@TGS#123"
    }


# ---------------- 群话题 (Topic) ----------------
class CreateTopicApi(BaseTimApi):
    api_id = "group_create_topic"
    name = "创建群话题"
    category = "群组管理"
    subcategory = "群话题 (Topic)"
    service_name = "group_open_http_svc"
    command = "create_topic"
    doc_url = "https://cloud.tencent.com/document/product/269/64988"
    description = "在社群 (Community) 中创建一个新的话题"

    fields = [
        Field("GroupId", "社群 ID", type="string", required=True, placeholder="例如: @TGS#c123"),
        Field("TopicName", "话题名称", type="string", required=True, placeholder="例如: 技术交流")
    ]

    sample_payload = {
        "GroupId": "@TGS#c123",
        "TopicName": "技术交流"
    }


class DestroyTopicApi(BaseTimApi):
    api_id = "group_destroy_topic"
    name = "解散群话题"
    category = "群组管理"
    subcategory = "群话题 (Topic)"
    service_name = "group_open_http_svc"
    command = "destroy_topic"
    doc_url = "https://cloud.tencent.com/document/product/269/64991"
    description = "解散社群中的指定话题"

    fields = [
        Field("GroupId", "社群 ID", type="string", required=True, placeholder="例如: @TGS#c123"),
        Field("TopicIdList", "话题 ID 列表", type="list", required=True, placeholder="例如: topic1,topic2")
    ]

    sample_payload = {
        "GroupId": "@TGS#c123",
        "TopicIdList": ["topic1"]
    }
