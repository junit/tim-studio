# -*- coding: utf-8 -*-
"""
帐号管理 API
对应文档: https://cloud.tencent.com/document/product/269/1520#account
"""

from .base import BaseTimApi, Field


def _normalize_account_items(input_data: dict, target_field: str) -> dict:
    if target_field in input_data:
        raw = input_data[target_field]
    elif "users" in input_data:
        raw = input_data["users"]
    elif "user_ids" in input_data:
        raw = input_data["user_ids"]
    else:
        raw = []

    if isinstance(raw, str):
        values = [value.strip() for value in raw.split(",") if value.strip()]
    elif isinstance(raw, list):
        if all(isinstance(value, str) for value in raw):
            values = [value.strip() for value in raw if value.strip()]
        elif all(isinstance(value, dict) and isinstance(value.get("UserID"), str) and value["UserID"].strip() for value in raw):
            values = [value["UserID"].strip() for value in raw]
        else:
            raise ValueError(f"{target_field} 必须是字符串账号列表或 UserID 对象列表")
    else:
        raise ValueError(f"{target_field} 必须是字符串或列表")

    if not values:
        raise ValueError(f"{target_field} 不能为空")
    return {target_field: [{"UserID": value} for value in values]}


class AccountImportApi(BaseTimApi):
    api_id = "account_import"
    name = "导入单个帐号"
    category = "帐号管理"
    subcategory = "帐号生命周期"
    service_name = "im_open_login_svc"
    command = "account_import"
    doc_url = "https://cloud.tencent.com/document/product/269/1608"
    description = "将自有帐号导入腾讯云 IM 系统中"

    fields = [
        Field("UserID", "用户 ID", type="string", required=True, placeholder="长度不超过 32 字节", aliases=["user_id", "UserID"]),
        Field("Nick", "用户昵称", type="string", required=False, placeholder="可选昵称"),
        Field("FaceUrl", "用户头像 URL", type="string", required=False, placeholder="https://...")
    ]

    sample_payload = {
        "UserID": "user_10001",
        "Nick": "张三",
        "FaceUrl": "https://example.com/avatar.png"
    }


class MultiAccountImportApi(BaseTimApi):
    api_id = "multiaccount_import"
    name = "导入多个帐号"
    category = "帐号管理"
    subcategory = "帐号生命周期"
    service_name = "im_open_login_svc"
    command = "multiaccount_import"
    doc_url = "https://cloud.tencent.com/document/product/269/4919"
    description = "单次最多支持导入 100 个帐号"

    fields = [
        Field("Accounts", "用户 ID 列表", type="list", required=True, placeholder="例如: user1,user2,user3", aliases=["accounts", "users"])
    ]

    sample_payload = {
        "Accounts": ["user1", "user2", "user3"]
    }


class AccountDeleteApi(BaseTimApi):
    api_id = "account_delete"
    name = "删除帐号"
    category = "帐号管理"
    subcategory = "帐号生命周期"
    service_name = "im_open_login_svc"
    command = "account_delete"
    doc_url = "https://cloud.tencent.com/document/product/269/36443"
    description = "删除指定帐号，单次最多支持删除 100 个"

    fields = [
        Field("DeleteItem", "待删除帐号列表", type="list", required=True, placeholder="例如: user1,user2", aliases=["users", "user_ids"])
    ]

    sample_payload = {
        "DeleteItem": [{"UserID": "user1"}, {"UserID": "user2"}]
    }

    def build_payload(self, input_data: dict) -> dict:
        return _normalize_account_items(input_data, "DeleteItem")


class AccountCheckApi(BaseTimApi):
    api_id = "account_check"
    name = "查询帐号"
    category = "帐号管理"
    subcategory = "帐号生命周期"
    service_name = "im_open_login_svc"
    command = "account_check"
    doc_url = "https://cloud.tencent.com/document/product/269/38417"
    description = "校验用户账号是否已导入腾讯云 IM，单次最多 100 个"

    fields = [
        Field("CheckItem", "待查询帐号列表", type="list", required=True, placeholder="例如: user1,user2", aliases=["users", "user_ids"])
    ]

    sample_payload = {
        "CheckItem": [{"UserID": "user1"}, {"UserID": "user2"}]
    }

    def build_payload(self, input_data: dict) -> dict:
        return _normalize_account_items(input_data, "CheckItem")


class KickApi(BaseTimApi):
    api_id = "account_kick"
    name = "失效帐号登录态 (踢下线)"
    category = "帐号管理"
    subcategory = "帐号生命周期"
    service_name = "im_open_login_svc"
    command = "kick"
    doc_url = "https://cloud.tencent.com/document/product/269/3853"
    description = "将指定帐号从当前登录的客户端强制踢下线"

    fields = [
        Field("UserID", "用户 ID", type="string", required=True, placeholder="待踢下线的用户 ID", aliases=["user_id", "UserID"])
    ]

    sample_payload = {
        "UserID": "user1"
    }


class QueryStateApi(BaseTimApi):
    api_id = "account_query_state"
    name = "查询帐号在线状态"
    category = "帐号管理"
    subcategory = "在线状态"
    service_name = "openim"
    command = "querystate"
    doc_url = "https://cloud.tencent.com/document/product/269/2566"
    description = "批量查询指定账号的当前在线状态（Online / Offline），单次最多 500 个"

    fields = [
        Field("To_Account", "用户 UserID 列表", type="list", required=True, placeholder="例如: user1,user2", aliases=["to_account", "users"])
    ]

    sample_payload = {
        "To_Account": ["user1", "user2"]
    }


class QueryOnlineStatusApi(BaseTimApi):
    api_id = "account_query_online_status"
    name = "查询帐号在线状态 (高级)"
    category = "帐号管理"
    subcategory = "在线状态"
    service_name = "openim"
    command = "query_online_status"
    doc_url = "https://cloud.tencent.com/document/product/269/4919"
    description = "支持单次批量查询最多 500 个用户的在线状态，包含详细平台终端信息"

    fields = [
        Field("To_Account", "用户 UserID 列表", type="list", required=True, placeholder="例如: user1,user2", aliases=["to_account", "users"]),
        Field("IsNeedDetail", "是否需要详细状态 (0/1)", type="number", required=False, default=1)
    ]

    sample_payload = {
        "To_Account": ["user1", "user2"],
        "IsNeedDetail": 1
    }
