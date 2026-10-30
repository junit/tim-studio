# -*- coding: utf-8 -*-
"""
腾讯云 API 3.0 通用驱动与云直播 (CSS) 扩展单元测试
"""

import os
import sys
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.tc3_client import TencentCloudApi3Client
from core.live_util import generate_live_push_url, generate_live_play_urls, parse_live_stream_url
from core.cloud_client import UniversalCloudClient
from core.registry import registry
from core.config import load_config, save_environment, mask_secret, is_secret_masked
from core.batch_presets import BATCH_PRESETS
from core.agent.constants import HIGH_RISK_API_KEYWORDS
from app import app


def test_tc3_signature_format():
    """测试 TC3-HMAC-SHA256 签名与头部生成规范"""
    client = TencentCloudApi3Client({
        "tc_secret_id": "AKIDtest123456",
        "tc_secret_key": "test_secret_key_abcdef",
        "tc_region": "ap-guangzhou"
    })

    headers = client.build_auth_headers(
        service="live",
        action="DescribeLiveStreamState",
        version="2018-08-01",
        payload={"AppName": "live", "DomainName": "play.test.com", "StreamName": "stream_1"},
        endpoint="live.tencentcloudapi.com",
        region="ap-guangzhou",
        secret_id="AKIDtest123456",
        secret_key="test_secret_key_abcdef",
        timestamp=1700000000
    )

    assert "Authorization" in headers
    assert headers["Authorization"].startswith("TC3-HMAC-SHA256 Credential=AKIDtest123456/")
    assert "SignedHeaders=content-type;host;x-tc-action" in headers["Authorization"]
    assert headers["X-TC-Action"] == "DescribeLiveStreamState"
    assert headers["X-TC-Version"] == "2018-08-01"
    assert headers["X-TC-Region"] == "ap-guangzhou"
    assert headers["Host"] == "live.tencentcloudapi.com"


def test_live_catalog_registration():
    """测试云直播 (CSS) 核心 API 正确注册至系统元数据目录"""
    live_state_api = registry.get_api("live_DescribeLiveStreamState")
    assert live_state_api is not None
    assert live_state_api.service_type == "live"
    assert live_state_api.service_name == "live"
    assert live_state_api.command == "DescribeLiveStreamState"
    assert live_state_api.category == "云直播 (CSS)"

    forbid_api = registry.get_api("live_ForbidLiveStream")
    assert forbid_api is not None
    assert forbid_api.service_type == "live"

    drop_api = registry.get_api("live_DropLiveStream")
    assert drop_api is not None

    services = registry.list_services()
    assert len(services) >= 2
    service_ids = [s["id"] for s in services]
    assert "im" in service_ids
    assert "live" in service_ids


def test_live_url_signers():
    """测试腾讯云直播推流与播放防盗链鉴权签名 (txSecret & txTime) 生成"""
    domain = "push.example.com"
    stream_name = "test_stream_01"
    key = "my_secret_anti_theft_key"

    push_info = generate_live_push_url(domain, stream_name, key, expire_seconds=3600, app_name="live")
    assert "txSecret=" in push_info["rtmp_push_url"]
    assert "txTime=" in push_info["rtmp_push_url"]
    assert push_info["rtmp_push_url"].startswith("rtmp://push.example.com/live/test_stream_01?")
    assert push_info["webrtc_push_url"].startswith("webrtc://push.example.com/live/test_stream_01?")

    play_info = generate_live_play_urls("play.example.com", stream_name, key, expire_seconds=3600)
    assert play_info["flv_play_url"].startswith("https://play.example.com/live/test_stream_01.flv?")
    assert play_info["hls_play_url"].startswith("https://play.example.com/live/test_stream_01.m3u8?")
    assert "txSecret=" in play_info["flv_play_url"]

    # 测试反解
    parsed = parse_live_stream_url(push_info["rtmp_push_url"])
    assert parsed["domain"] == "push.example.com"
    assert parsed["app_name"] == "live"
    assert parsed["stream_name"] == "test_stream_01"
    assert parsed["txSecret"] == push_info["txSecret"]


def test_universal_cloud_client_routing():
    """测试 UniversalCloudClient 智能分发 (IM vs API 3.0)"""
    client = UniversalCloudClient()

    # 1. 验证 IM 预览
    im_api = registry.get_api("c2c_msg_withdraw")
    assert im_api is not None
    preview_im = client.generate_preview(im_api, {"from_account": "u1", "to_account": "u2", "msg_key": "k1"})
    assert preview_im["service_type"] == "im"
    assert "usersig=" in preview_im["preview_url"]

    # 2. 验证 API 3.0 云直播预览
    live_api = registry.get_api("live_DescribeLiveStreamState")
    assert live_api is not None
    preview_live = client.generate_preview(live_api, {"AppName": "live", "DomainName": "d1", "StreamName": "s1"})
    assert preview_live["service_type"] == "live"
    assert "live.tencentcloudapi.com" in preview_live["preview_url"]
    assert "X-TC-Action" in preview_live["headers"]
    assert "Authorization" in preview_live["headers"]
    assert "TC3-HMAC-SHA256" in preview_live["curl_command"]

    # 3. 验证非 Live 服务 (如 TRTC / VOD) 端点不会被 live.tencentcloudapi.com 劫持
    class MockTrtcApi:
        service_type = "trtc"
        service_name = "trtc"
        command = "DescribeCallDetail"
        action = "DescribeCallDetail"
        version = "2019-07-22"

    preview_trtc = client.generate_preview(MockTrtcApi(), {})
    assert preview_trtc["service_type"] == "trtc"
    assert "trtc.tencentcloudapi.com" in preview_trtc["preview_url"]
    assert "live.tencentcloudapi.com" not in preview_trtc["preview_url"]


def test_fastapi_endpoints_for_live():
    """测试 FastAPI 服务端点对云直播与多服务的支持"""
    client = TestClient(app)

    # 1. 服务列表端点
    resp_svc = client.get("/api/services")
    assert resp_svc.status_code == 200
    svc_data = resp_svc.json()
    assert svc_data["status"] == "success"
    assert any(s["id"] == "live" for s in svc_data["data"])

    # 2. 过滤云直播 API
    resp_live_apis = client.get("/api/apis?service=live")
    assert resp_live_apis.status_code == 200
    live_apis = resp_live_apis.json()["data"]
    assert len(live_apis) >= 10
    assert all(a["service_type"] == "live" for a in live_apis)

    # 3. 直播防盗链签名计算端点
    resp_sign = client.post("/api/live/sign-url", json={
        "stream_name": "room_test_1001",
        "domain": "push.test.com",
        "key": "testkey123"
    })
    assert resp_sign.status_code == 200
    sign_data = resp_sign.json()
    assert sign_data["status"] == "success"
    assert "push" in sign_data["data"]
    assert "txSecret" in sign_data["data"]["push"]

    # 4. 预览模式调用云直播 API
    resp_invoke = client.post("/api/apis/live_DescribeLiveStreamState/invoke", json={
        "payload": {
            "AppName": "live",
            "DomainName": "play.test.com",
            "StreamName": "room_1001"
        },
        "dry_run": True
    })
    assert resp_invoke.status_code == 200
    invoke_data = resp_invoke.json()
    assert invoke_data["status"] == "success"
    assert invoke_data["dry_run"] is True
    assert invoke_data["service_type"] == "live"
    assert "headers" in invoke_data


def test_batch_presets_and_agent_risk_keywords():
    """测试批量中心预设模版与智能体高危风控关键词包含云直播"""
    preset_ids = [p["id"] for p in BATCH_PRESETS]
    assert "preset_live_drop_stream" in preset_ids
    assert "preset_live_check_state" in preset_ids

    # 验证智能体高危关键词包含断流与禁推
    assert "forbidlivestream" in HIGH_RISK_API_KEYWORDS
    assert "droplivestream" in HIGH_RISK_API_KEYWORDS


def test_create_common_mix_stream_complex_parameters():
    """测试 CreateCommonMixStream (直播混流) 数组与复杂对象参数类型精准度"""
    mix_api = registry.get_api("live_CreateCommonMixStream")
    assert mix_api is not None
    assert mix_api.command == "CreateCommonMixStream"

    fields_dict = {f.name: f for f in mix_api.fields}
    assert "InputStreamList" in fields_dict
    assert fields_dict["InputStreamList"].type == "list"

    assert "OutputParams" in fields_dict
    assert fields_dict["OutputParams"].type == "json"
    assert fields_dict["OutputParams"].struct_name == "CommonMixOutputParams"
    assert len(fields_dict["OutputParams"].sub_fields) == 9
    sub_names = [sf["name"] for sf in fields_dict["OutputParams"].sub_fields]
    assert "OutputStreamName" in sub_names
    assert "OutputStreamType" in sub_names
    assert "OutputStreamBitRate" in sub_names

    assert "ControlParams" in fields_dict
    assert fields_dict["ControlParams"].type == "json"
    assert fields_dict["ControlParams"].struct_name == "CommonMixControlParams"
    assert len(fields_dict["ControlParams"].sub_fields) == 4

    assert fields_dict["InputStreamList"].type == "list"
    assert fields_dict["InputStreamList"].struct_name == "CommonMixInputParam"
    assert fields_dict["InputStreamList"].item_schema is not None
    assert len(fields_dict["InputStreamList"].item_schema["fields"]) == 4

    assert "MixStreamSessionId" in fields_dict
    assert fields_dict["MixStreamSessionId"].type == "string"

    # 验证 sample_payload 结构完整性
    sp = mix_api.sample_payload
    assert isinstance(sp.get("InputStreamList"), list)
    assert len(sp["InputStreamList"]) >= 1
    assert "LayoutParams" in sp["InputStreamList"][0]
    assert isinstance(sp["InputStreamList"][0]["LayoutParams"], dict)
    assert isinstance(sp.get("OutputParams"), dict)


def test_live_catalog_complex_types_integrity():
    """测试云直播全量 catalog 中复杂对象与数组类型无 string 降级碰撞"""
    import json
    catalog_path = os.path.join(os.path.dirname(__file__), "..", "core", "live_full_catalog.json")
    with open(catalog_path, "r", encoding="utf-8") as f:
        apis = json.load(f)

    for api in apis:
        sp = api.get("sample_payload", {})
        fields = {f["name"]: f for f in api.get("fields", [])}
        for k, v in sp.items():
            if k in fields:
                ft = fields[k].get("type")
                if isinstance(v, dict):
                    assert ft == "json", f"{api['command']}.{k} sample is dict but type is {ft}"
                elif isinstance(v, list):
                    assert ft == "list", f"{api['command']}.{k} sample is list but type is {ft}"

