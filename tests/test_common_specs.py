# -*- coding: utf-8 -*-
"""
腾讯云 API 3.0 公共规范与公共文档同步单元测试
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from core.common_specs_syncer import common_specs_manager

client = TestClient(app)


def test_common_specs_loaded():
    specs = common_specs_manager.get_specs()
    assert specs is not None
    assert "invocation" in specs
    assert "structs" in specs
    assert "errors" in specs
    assert "mappings" in specs

    # 验证数据结构中包含 CommonMixOutputParams
    structs = specs.get("structs", {}).get("structs", {})
    assert "CommonMixOutputParams" in structs
    assert len(structs["CommonMixOutputParams"]) >= 8

    # 验证公共参数
    common_params = specs.get("invocation", {}).get("common_params", {})
    headers = [h["header"] for h in common_params.get("v3_headers", [])]
    assert "X-TC-Action" in headers
    assert "X-TC-Version" in headers
    assert "Authorization" in headers


def test_error_lookup():
    # 业务错误码测试
    err = common_specs_manager.lookup_error("FailedOperation.StreamNotExist")
    assert err is not None
    assert err["code"] == "FailedOperation.StreamNotExist"
    assert "流不存在" in err["desc"]
    assert err["scope"] == "business"

    # 全局错误码测试
    err_auth = common_specs_manager.lookup_error("AuthFailure.SignatureFailure")
    assert err_auth is not None
    assert "签名" in err_auth["desc"]
    assert err_auth["scope"] == "global"


def test_api_common_specs_endpoints():
    # 完整接口
    resp = client.get("/api/common-specs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "invocation" in data["data"]
    assert "structs" in data["data"]

    # 分类接口
    resp_cat = client.get("/api/common-specs?category=common_params")
    assert resp_cat.status_code == 200
    cat_data = resp_cat.json()
    assert cat_data["status"] == "success"
    assert len(cat_data["data"]["v3_headers"]) > 0

    # 错误码检索接口
    resp_err = client.get("/api/common-specs/error-lookup?code=FailedOperation.StreamNotExist")
    assert resp_err.status_code == 200
    err_json = resp_err.json()
    assert err_json["status"] == "success"
    assert err_json["data"]["code"] == "FailedOperation.StreamNotExist"
