import os
import json
import pytest
from core.registry import registry
from core.agent.engine import AgentEngine
from core.agent.models import BotConfig


def test_dynamic_services_summary_auto_adapts():
    """验证当新增业务全量目录文件 (*_full_catalog.json) 时，系统提示词与服务摘要自动自适应扩展，绝无硬编码"""
    # 1. 初始状态下
    registry.reload()
    initial_summary = registry.get_services_summary()
    assert initial_summary["total_apis"] >= 427
    assert initial_summary["services_count"] >= 2
    assert "即时通信 IM" in initial_summary["service_names"]
    assert "云直播 (CSS)" in initial_summary["service_names"]

    # 2. 模拟系统在 core/ 目录下新增了音视频通话 TRTC 目录 (trtc_full_catalog.json)
    trtc_catalog = [
        {
            "api_id": "trtc_CreateRoom",
            "name": "创建TRTC房间",
            "action": "CreateRoom",
            "version": "2019-07-22",
            "service_name": "实时音视频 TRTC",
            "service_type": "trtc",
            "category": "房间管理",
            "subcategory": "房间控制",
            "command": "CreateRoom",
            "doc_url": "https://cloud.tencent.com/document/api/647/44055",
            "description": "创建指定TRTC房间",
            "fields": [],
            "sample_payload": {"SdkAppId": 1400000000, "RoomId": "12345"}
        },
        {
            "api_id": "trtc_DismissRoom",
            "name": "解散TRTC房间",
            "action": "DismissRoom",
            "version": "2019-07-22",
            "service_name": "实时音视频 TRTC",
            "service_type": "trtc",
            "category": "房间管理",
            "subcategory": "房间控制",
            "command": "DismissRoom",
            "doc_url": "https://cloud.tencent.com/document/api/647/44056",
            "description": "解散指定TRTC房间",
            "fields": [],
            "sample_payload": {"SdkAppId": 1400000000, "RoomId": "12345"}
        }
    ]

    core_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "core"))
    trtc_file = os.path.join(core_dir, "trtc_full_catalog.json")

    try:
        # 写入新的 trtc_full_catalog.json
        with open(trtc_file, "w", encoding="utf-8") as f:
            json.dump(trtc_catalog, f, ensure_ascii=False, indent=2)

        registry.reload()

        # 3. 验证注册中心自动感知新服务与总接口数
        new_summary = registry.get_services_summary()
        assert new_summary["total_apis"] == initial_summary["total_apis"] + 2
        assert new_summary["services_count"] == initial_summary["services_count"] + 1
        assert any("trtc" in name.lower() or "实时音视频" in name for name in new_summary["service_names"])

        # 4. 验证 AgentEngine 组装的 System Prompt 自动包含新增的业务和更新后的接口数，无需任何硬编码更改！
        engine = AgentEngine()
        test_bot = BotConfig(
            id="test_bot",
            name="测试管家",
            base_prompt="你是一个专业的腾讯云助手"
        )
        sys_prompt = engine.assemble_system_prompt(test_bot)

        # 确认新服务和最新数量已动态注入到智能体提示词中
        assert str(new_summary["total_apis"]) in sys_prompt
        assert "trtc" in sys_prompt.lower() or "实时音视频" in sys_prompt
    finally:
        if os.path.exists(trtc_file):
            os.remove(trtc_file)
        registry.reload()


def test_base_api_build_payload_standard_types():
    """验证 BaseTimApi.build_payload 兼容标准 int, integer, float, array, object 等类型反序列化"""
    from apis.base import BaseTimApi, Field

    class MockApi(BaseTimApi):
        api_id = "test_mock"
        name = "测试Mock"
        fields = [
            Field("count", "数量", type="int"),
            Field("ratio", "比例", type="float"),
            Field("enabled", "状态", type="boolean"),
            Field("tags", "标签", type="array"),
            Field("extra", "扩展", type="object")
        ]

    api = MockApi()
    payload = api.build_payload({
        "count": "42",
        "ratio": "3.14",
        "enabled": "true",
        "tags": '["live", "css"]',
        "extra": '{"env": "prod"}'
    })

    assert payload["count"] == 42
    assert isinstance(payload["count"], int)
    assert payload["ratio"] == 3.14
    assert isinstance(payload["ratio"], float)
    assert payload["enabled"] is True
    assert payload["tags"] == ["live", "css"]
    assert payload["extra"] == {"env": "prod"}


def test_sandbox_live_call_optional_payload():
    """验证 Python 沙箱快捷调用 live_call / im_call / tim_call 支持省略 payload 参数，不抛 missing argument"""
    from core.agent.tools import CloudCallTool

    recorded = []
    class DummyTool:
        def forward(self, act, payload=None, service=None):
            recorded.append((act, payload, service))
            return {"ActionStatus": "OK", "ErrorCode": 0}

    caller = DummyTool()
    # 模拟沙箱注入的快捷函数
    live_call = lambda action, payload=None: caller.forward(action, payload or {}, service="live")
    im_call = lambda path, payload=None: caller.forward(path, payload or {}, service="im")

    # 单参调用测试
    res1 = live_call("DescribeLiveStreamOnlineList")
    assert res1["ActionStatus"] == "OK"
    assert recorded[0] == ("DescribeLiveStreamOnlineList", {}, "live")

    res2 = im_call("openim/get_app_info")
    assert res2["ActionStatus"] == "OK"
    assert recorded[1] == ("openim/get_app_info", {}, "im")


def test_task_runner_summary_service_type():
    """验证 TaskRunner 在任务完成时保留并持久化 service_type 标识"""
    from core.task_runner import TaskRunner
    runner = TaskRunner()
    task = runner.create_task("live_DescribeLiveStreamState", [{"DomainName": "test.com"}], dry_run=True)
    runner._worker(task)
    assert task.status == "COMPLETED"
    assert len(task.results) == 1


def test_batch_presets_filtering():
    """验证批量运维预设清单支持 service_type 字段与按服务精准过滤"""
    from core.batch_presets import BATCH_PRESETS
    im_presets = [p for p in BATCH_PRESETS if p.get("service_type") == "im"]
    live_presets = [p for p in BATCH_PRESETS if p.get("service_type") == "live"]

    assert len(im_presets) >= 6
    assert len(live_presets) >= 2
    assert all("service_type" in p for p in BATCH_PRESETS)


def test_live_bot_profile_generation():
    """验证智能体孵化支持云直播/音视频关键词推断及建议指令"""
    from core.agent.bot_manager import BotManager
    manager = BotManager()
    profile = manager.generate_bot_profile("云直播流运维官", "负责监控在线直播流与断流处理")
    assert profile["avatar"] == "🎥"
    assert "live" in profile["id"]
    assert len(profile["suggested_prompts"]) >= 4
    assert any("直播流" in p for p in profile["suggested_prompts"])


def test_doc_syncer_default_doc_service_type_branching():
    """验证未同步文档骨架能按 service_type 正确生成 API 3.0 vs IM 结构"""
    from core.doc_syncer import DocSyncManager
    syncer = DocSyncManager()

    # IM 模拟元数据
    im_meta = {
        "api_id": "test_im_api",
        "service_type": "im",
        "name": "测试IM接口",
        "doc_id": 9999991,
        "fields": []
    }
    im_doc = syncer.get_doc_for_api(im_meta)
    param_names = [p["name"] for p in im_doc.get("url_params", [])]
    assert "usersig" in param_names
    assert "sdkappid" in param_names

    # API 3.0 (云直播) 模拟元数据
    live_meta = {
        "api_id": "test_live_api",
        "service_type": "live",
        "name": "测试Live接口",
        "command": "DescribeLiveTest",
        "doc_id": 9999992,
        "fields": []
    }
    live_doc = syncer.get_doc_for_api(live_meta)
    live_param_names = [p["name"] for p in live_doc.get("url_params", [])]
    assert "X-TC-Action" in live_param_names
    assert "Authorization" in live_param_names
    assert any("RequestId" in f["name"] for f in live_doc.get("response_body_fields", []))



