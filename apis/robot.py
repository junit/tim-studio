# -*- coding: utf-8 -*-
"""
机器人管理 API
对应文档: https://cloud.tencent.com/document/product/269/1520#robot
"""

from .base import BaseTimApi, Field


class CreateRobotApi(BaseTimApi):
    api_id = "robot_create"
    name = "创建机器人"
    category = "机器人管理"
    subcategory = "机器人管理"
    service_name = "robot_open_http_svc"
    command = "create_robot"
    doc_url = "https://cloud.tencent.com/document/product/269/96307"
    description = "在 App 中创建一个具备自动回复和对话能力的机器人账号"

    fields = [
        Field("UserID", "机器人 UserID", type="string", required=True, placeholder="例如: bot_001"),
        Field("Nick", "机器人昵称", type="string", required=False, default="智能助理"),
        Field("FaceUrl", "机器人头像 URL", type="string", required=False, placeholder="https://...")
    ]

    sample_payload = {
        "UserID": "bot_001",
        "Nick": "智能助手",
        "FaceUrl": "https://example.com/bot.png"
    }


class DeleteRobotApi(BaseTimApi):
    api_id = "robot_delete"
    name = "删除机器人"
    category = "机器人管理"
    subcategory = "机器人管理"
    service_name = "robot_open_http_svc"
    command = "delete_robot"
    doc_url = "https://cloud.tencent.com/document/product/269/96308"
    description = "注销并删除指定的机器人账号"

    fields = [
        Field("UserID", "待删除机器人 UserID", type="string", required=True, placeholder="例如: bot_001")
    ]

    sample_payload = {
        "UserID": "bot_001"
    }


class GetAllRobotsApi(BaseTimApi):
    api_id = "robot_get_all"
    name = "拉取所有机器人"
    category = "机器人管理"
    subcategory = "机器人管理"
    service_name = "robot_open_http_svc"
    command = "get_all_robots"
    doc_url = "https://cloud.tencent.com/document/product/269/96309"
    description = "拉取 App 当前创建的所有机器人账号列表"

    fields = []

    sample_payload = {}
