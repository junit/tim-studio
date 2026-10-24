# -*- coding: utf-8 -*-
"""
资料与关系链管理 API
对应文档: https://cloud.tencent.com/document/product/269/1520#sns
"""

from .base import BaseTimApi, Field


# ---------------- 资料管理 ----------------
class PortraitSetApi(BaseTimApi):
    api_id = "profile_portrait_set"
    name = "设置用户资料"
    category = "资料与关系链"
    subcategory = "资料管理"
    service_name = "profile"
    command = "portrait_set"
    doc_url = "https://cloud.tencent.com/document/product/269/1640"
    description = "设置用户的昵称、头像、签名、自定义属性等个人资料"

    fields = [
        Field("From_Account", "目标用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("Nick", "用户昵称 (Tag_Profile_IM_Nick)", type="string", required=False, placeholder="新昵称"),
        Field("FaceUrl", "头像 URL (Tag_Profile_IM_Image)", type="string", required=False, placeholder="https://..."),
        Field("SelfSignature", "个性签名 (Tag_Profile_IM_SelfSignature)", type="string", required=False, placeholder="签名内容")
    ]

    sample_payload = {
        "From_Account": "user1",
        "ProfileItem": [
            {"Tag": "Tag_Profile_IM_Nick", "Value": "小明"},
            {"Tag": "Tag_Profile_IM_SelfSignature", "Value": "热爱生活"}
        ]
    }

    def build_payload(self, input_data: dict) -> dict:
        def get_val(*keys):
            for k in keys:
                for actual_k, v in input_data.items():
                    if actual_k.lower().replace("_", "") == k.lower().replace("_", ""):
                        if v is not None and str(v).strip() != "":
                            return v
            return None

        from_acc = get_val("From_Account", "from_account", "account", "user_id")
        nick = get_val("Nick", "nick", "Tag_Profile_IM_Nick")
        face_url = get_val("FaceUrl", "face_url", "avatar", "Tag_Profile_IM_Image")
        self_sig = get_val("SelfSignature", "self_signature", "sign", "Tag_Profile_IM_SelfSignature")

        if nick or face_url or self_sig:
            items = []
            if nick:
                items.append({"Tag": "Tag_Profile_IM_Nick", "Value": str(nick)})
            if face_url:
                items.append({"Tag": "Tag_Profile_IM_Image", "Value": str(face_url)})
            if self_sig:
                items.append({"Tag": "Tag_Profile_IM_SelfSignature", "Value": str(self_sig)})
            return {
                "From_Account": str(from_acc) if from_acc else "",
                "ProfileItem": items
            }
        if "ProfileItem" in input_data:
            return input_data
        return super().build_payload(input_data)
        items = []
        if input_data.get("Nick"):
            items.append({"Tag": "Tag_Profile_IM_Nick", "Value": input_data["Nick"]})
        if input_data.get("FaceUrl"):
            items.append({"Tag": "Tag_Profile_IM_Image", "Value": input_data["FaceUrl"]})
        if input_data.get("SelfSignature"):
            items.append({"Tag": "Tag_Profile_IM_SelfSignature", "Value": input_data["SelfSignature"]})
        return {
            "From_Account": input_data.get("From_Account"),
            "ProfileItem": items
        }


class PortraitGetApi(BaseTimApi):
    api_id = "profile_portrait_get"
    name = "拉取用户资料"
    category = "资料与关系链"
    subcategory = "资料管理"
    service_name = "profile"
    command = "portrait_get"
    doc_url = "https://cloud.tencent.com/document/product/269/1639"
    description = "批量获取指定用户的个人资料（单次最多 100 个用户）"

    fields = [
        Field("To_Account", "待查询用户 UserID 列表", type="list", required=True, placeholder="例如: user1,user2")
    ]

    sample_payload = {
        "To_Account": ["user1", "user2"],
        "TagList": [
            "Tag_Profile_IM_Nick",
            "Tag_Profile_IM_Image",
            "Tag_Profile_IM_SelfSignature",
            "Tag_Profile_IM_Gender"
        ]
    }

    def build_payload(self, input_data: dict) -> dict:
        accs = input_data.get("To_Account")
        if isinstance(accs, str):
            accs = [x.strip() for x in accs.split(",") if x.strip()]
        return {
            "To_Account": accs,
            "TagList": input_data.get("TagList", [
                "Tag_Profile_IM_Nick",
                "Tag_Profile_IM_Image",
                "Tag_Profile_IM_SelfSignature"
            ])
        }


# ---------------- 好友管理 ----------------
class FriendAddApi(BaseTimApi):
    api_id = "sns_friend_add"
    name = "添加好友"
    category = "资料与关系链"
    subcategory = "好友管理"
    service_name = "sns"
    command = "friend_add"
    doc_url = "https://cloud.tencent.com/document/product/269/1643"
    description = "支持单向加好友或双向直接加为好友"

    fields = [
        Field("From_Account", "用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("To_Account", "目标好友 UserID", type="string", required=True, placeholder="例如: user2"),
        Field("AddType", "加好友类型 (Add_Type_Both: 双向, Add_Type_Single: 单向)", type="string", required=False, default="Add_Type_Both"),
        Field("GroupName", "好友分组名", type="string", required=False, default="我的好友")
    ]

    sample_payload = {
        "From_Account": "user1",
        "AddFriendItem": [
            {
                "To_Account": "user2",
                "AddSource": "AddSource_Type_Admin",
                "GroupName": "我的好友"
            }
        ],
        "AddType": "Add_Type_Both",
        "ForceAddFlags": 1
    }

    def build_payload(self, input_data: dict) -> dict:
        if input_data.get("To_Account"):
            return {
                "From_Account": input_data.get("From_Account"),
                "AddFriendItem": [
                    {
                        "To_Account": input_data.get("To_Account"),
                        "AddSource": "AddSource_Type_Admin",
                        "GroupName": input_data.get("GroupName", "我的好友")
                    }
                ],
                "AddType": input_data.get("AddType", "Add_Type_Both"),
                "ForceAddFlags": 1
            }
        if "AddFriendItem" in input_data:
            return input_data
        return {
            "From_Account": input_data.get("From_Account"),
            "AddFriendItem": [
                {
                    "To_Account": input_data.get("To_Account"),
                    "AddSource": "AddSource_Type_Admin",
                    "GroupName": input_data.get("GroupName", "我的好友")
                }
            ],
            "AddType": input_data.get("AddType", "Add_Type_Both"),
            "ForceAddFlags": 1
        }


class FriendDeleteApi(BaseTimApi):
    api_id = "sns_friend_delete"
    name = "删除好友"
    category = "资料与关系链"
    subcategory = "好友管理"
    service_name = "sns"
    command = "friend_delete"
    doc_url = "https://cloud.tencent.com/document/product/269/1646"
    description = "批量删除好友（单向或双向删除）"

    fields = [
        Field("From_Account", "用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("To_Account", "待删除好友 UserID 列表", type="list", required=True, placeholder="例如: user2,user3"),
        Field("DeleteType", "删除类型 (Delete_Type_Both: 双向, Delete_Type_Single: 单向)", type="string", required=False, default="Delete_Type_Both")
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": ["user2"],
        "DeleteType": "Delete_Type_Both"
    }


class FriendCheckApi(BaseTimApi):
    api_id = "sns_friend_check"
    name = "校验好友关系"
    category = "资料与关系链"
    subcategory = "好友管理"
    service_name = "sns"
    command = "friend_check"
    doc_url = "https://cloud.tencent.com/document/product/269/1648"
    description = "校验两个或多个用户之间是否存在好友关系"

    fields = [
        Field("From_Account", "发起方 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("To_Account", "校验对象 UserID 列表", type="list", required=True, placeholder="例如: user2,user3"),
        Field("CheckType", "校验类型 (CheckResult_Type_Both: 双向, CheckResult_Type_Single: 单向)", type="string", required=False, default="CheckResult_Type_Both")
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": ["user2"],
        "CheckType": "CheckResult_Type_Both"
    }


class FriendGetApi(BaseTimApi):
    api_id = "sns_friend_get"
    name = "拉取好友列表"
    category = "资料与关系链"
    subcategory = "好友管理"
    service_name = "sns"
    command = "friend_get"
    doc_url = "https://cloud.tencent.com/document/product/269/1649"
    description = "分页拉取指定用户的所有好友关系链资料"

    fields = [
        Field("From_Account", "查询方 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("StartIndex", "分页起始游标 (初次填 0)", type="number", required=False, default=0)
    ]

    sample_payload = {
        "From_Account": "user1",
        "StartIndex": 0,
        "StandardSequence": 0,
        "CustomSequence": 0
    }


# ---------------- 黑名单管理 ----------------
class BlackListAddApi(BaseTimApi):
    api_id = "sns_black_list_add"
    name = "添加黑名单"
    category = "资料与关系链"
    subcategory = "黑名单管理"
    service_name = "sns"
    command = "black_list_add"
    doc_url = "https://cloud.tencent.com/document/product/269/3718"
    description = "为指定用户添加黑名单"

    fields = [
        Field("From_Account", "操作用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("To_Account", "加入黑名单的用户 UserID 列表", type="list", required=True, placeholder="例如: bad_user1,bad_user2")
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": ["bad_user1"]
    }


class BlackListDeleteApi(BaseTimApi):
    api_id = "sns_black_list_delete"
    name = "删除黑名单"
    category = "资料与关系链"
    subcategory = "黑名单管理"
    service_name = "sns"
    command = "black_list_delete"
    doc_url = "https://cloud.tencent.com/document/product/269/3719"
    description = "将指定用户移出黑名单"

    fields = [
        Field("From_Account", "操作用户 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("To_Account", "移出黑名单的用户 UserID 列表", type="list", required=True, placeholder="例如: bad_user1")
    ]

    sample_payload = {
        "From_Account": "user1",
        "To_Account": ["bad_user1"]
    }


class BlackListGetApi(BaseTimApi):
    api_id = "sns_black_list_get"
    name = "拉取黑名单"
    category = "资料与关系链"
    subcategory = "黑名单管理"
    service_name = "sns"
    command = "black_list_get"
    doc_url = "https://cloud.tencent.com/document/product/269/3722"
    description = "查询指定用户的黑名单列表"

    fields = [
        Field("From_Account", "查询方 UserID", type="string", required=True, placeholder="例如: user1"),
        Field("StartIndex", "分页起始游标 (初次填 0)", type="number", required=False, default=0),
        Field("MaxLimited", "单次拉取数量上限", type="number", required=False, default=100)
    ]

    sample_payload = {
        "From_Account": "user1",
        "StartIndex": 0,
        "MaxLimited": 100,
        "LastSequence": 0
    }
