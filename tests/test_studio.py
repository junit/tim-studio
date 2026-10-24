# -*- coding: utf-8 -*-
"""
TIM Studio 核心功能单元测试
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

# 确保加载项目根路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.sig_util import gen_user_sig
from core.config import mask_secret, is_secret_masked, load_config
from core.registry import registry
from core.batch_presets import BATCH_PRESETS, get_api_batch_guidance
from app import app


def test_user_sig_generation():
    """测试 TLSSigAPIv2 (UserSig) 生成与内存复用缓存"""
    sdkappid = 1400000000
    dummy_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    identifier = "administrator"

    sig1 = gen_user_sig(sdkappid, dummy_key, identifier)
    assert sig1 is not None
    assert len(sig1) > 20
    assert not sig1.startswith("Error")

    # 第二次调用应当命中内存缓存返回相同字符串
    sig2 = gen_user_sig(sdkappid, dummy_key, identifier)
    assert sig1 == sig2


def test_secret_masking():
    """测试密钥全链路脱敏及防覆盖判断逻辑"""
    raw_key = "ca3e11865daf71e6bbf0d0b19b1f1249a9320036f3e39b7caf456797abf4c364"
    masked = mask_secret(raw_key)

    assert masked.startswith("ca3e")
    assert masked.endswith("c364")
    assert "*" in masked
    assert is_secret_masked(masked) is True
    assert is_secret_masked(raw_key) is False


def test_api_registry_catalog():
    """测试官方 166 项全量 REST API 注册表正确加载"""
    apis = registry.list_apis()
    assert len(apis) >= 166

    # 抽样验证核心关键接口
    withdraw_api = registry.get_api("c2c_msg_withdraw")
    assert withdraw_api is not None
    assert "admin_msgwithdraw" in withdraw_api.command
    assert withdraw_api.category == "消息相关"


def test_batch_presets_and_guidance():
    """测试批处理高频预设与 QPS 风控规则"""
    assert len(BATCH_PRESETS) >= 5

    guidance = get_api_batch_guidance("c2c_msg_withdraw")
    assert guidance is not None
    assert guidance["api_id"] == "c2c_msg_withdraw"
    assert guidance["min_delay"] > 0


def test_fastapi_endpoints():
    """测试核心 API 端点可访问性与结构正确性"""
    client = TestClient(app)

    # 1. 静态主页
    resp_home = client.get("/")
    assert resp_home.status_code == 200

    # 2. 接口清单端点
    resp_apis = client.get("/api/apis")
    assert resp_apis.status_code == 200
    apis_data = resp_apis.json()
    assert apis_data["status"] == "success"
    assert len(apis_data["data"]) >= 166

    # 3. 预设场景端点
    resp_presets = client.get("/api/batch/presets")
    assert resp_presets.status_code == 200
    presets_data = resp_presets.json()
    assert presets_data["status"] == "success"
    assert len(presets_data["data"]) >= 5
