# -*- coding: utf-8 -*-
"""
腾讯云 IM API 通用客户端
"""

import json
import random
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import load_config
from .sig_util import gen_user_sig


class TimClient:
    def __init__(self, config=None):
        self._custom_config = config

    @property
    def config(self) -> dict:
        if self._custom_config is not None:
            return self._custom_config
        return load_config()

    def get_usersig(self) -> str:
        sdkappid = self.config.get("sdkappid")
        secret_key = self.config.get("secret_key")
        admin_user = self.config.get("admin_user", "administrator")
        if not sdkappid or not secret_key:
            raise ValueError("SDKAppID 或 SecretKey 未配置，请先完善配置信息")
        return gen_user_sig(int(sdkappid), secret_key, admin_user)

    def invoke(self, service_name: str, command: str, payload: dict, timeout: int = 15) -> dict:
        """
        调用腾讯云 IM REST API
        URL: https://{domain}/v4/{service_name}/{command}?sdkappid=...&identifier=...&usersig=...&random=...&contenttype=json
        """
        sdkappid = self.config.get("sdkappid")
        admin_user = self.config.get("admin_user", "administrator")
        domain = self.config.get("domain", "console.tim.qq.com")
        usersig = self.get_usersig()
        rand = random.randint(0, 4294967295)

        # 兼容归一化：若 command 包含 v4/ 或 service_name
        cmd = command
        svc = service_name
        if cmd.startswith("v4/"):
            cmd = cmd[3:]
        parts = cmd.split("/", 1)
        if len(parts) == 2:
            svc = parts[0]
            cmd = parts[1]

        url = (
            f"https://{domain}/v4/{svc}/{cmd}"
            f"?sdkappid={sdkappid}&identifier={admin_user}&usersig={usersig}&random={rand}&contenttype=json"
        )

        data_bytes = json.dumps(payload).encode("utf-8")
        req = Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json;charset=utf-8"},
            method="POST"
        )
        t_start = time.time()
        try:
            with urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode("utf-8")
                elapsed_ms = int((time.time() - t_start) * 1000)
                parsed = json.loads(body)
                parsed["_cost_ms"] = elapsed_ms
                return parsed
        except HTTPError as e:
            elapsed_ms = int((time.time() - t_start) * 1000)
            err_body = e.read().decode("utf-8", errors="ignore")
            return {
                "ActionStatus": "FAIL",
                "ErrorCode": e.code,
                "ErrorInfo": f"HTTP {e.code}: {err_body}",
                "_cost_ms": elapsed_ms
            }
        except URLError as e:
            elapsed_ms = int((time.time() - t_start) * 1000)
            return {
                "ActionStatus": "FAIL",
                "ErrorCode": -1,
                "ErrorInfo": f"网络连接失败: {e.reason}",
                "_cost_ms": elapsed_ms
            }
        except Exception as e:
            elapsed_ms = int((time.time() - t_start) * 1000)
            return {
                "ActionStatus": "FAIL",
                "ErrorCode": -2,
                "ErrorInfo": str(e),
                "_cost_ms": elapsed_ms
            }

    def test_connection(self) -> dict:
        """
        通过查询管理员自身的在线状态验证 SDKAppID、SecretKey 及网络连通性
        """
        admin_user = self.config.get("admin_user", "administrator")
        payload = {"To_Account": [admin_user]}
        res = self.invoke("openim", "querystate", payload, timeout=10)
        return res

    def __call__(self, api_path: str = "", payload: dict | None = None, timeout: int = 15) -> dict:
        """
        支持将 TimClient 实例直接作为快捷函数调用
        例如: tim_client(api_path="group_open_http_svc/get_appid_group_list", payload={...})
        """
        return self.invoke("", api_path, payload or {}, timeout=timeout)
