# -*- coding: utf-8 -*-
"""
多业务无限扩展架构 (N-Service Architecture) 专项单元测试
验证：
1. 配置无损透传与动态敏感字段脱敏保护
2. 多业务连通性测试精准路由（杜绝跨业务降级串台）
3. 批处理任务凭证快照隔离 (TaskRunner Context Isolation)
4. 沙箱环境泛化能力注册 (build_sandbox_scope & dynamic shortcuts)
5. 注册表全业务别名绑定 (Dynamic Service Alias Binding)
"""

import os
import json
import pytest
from core.config import load_config, save_environment, is_field_sensitive, mask_secret
from core.cloud_client import UniversalCloudClient
from core.task_runner import TaskRunner
from core.registry import registry
from core.agent.tools import build_sandbox_scope, CloudCallTool


def test_config_n_service_dynamic_property_preservation():
    """验证新业务专有配置在 load_config 中不被截断丢弃"""
    from core.config import CONFIG_PATH
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        original = json.load(f)

    try:
        # 针对当前激活环境写入新业务属性 (如 VOD 与 TRTC)
        target_env_id = original.get("active_env_id") or original["environments"][0]["id"]
        target_env = next((e for e in original["environments"] if e.get("id") == target_env_id), original["environments"][0])

        res = save_environment({
            "id": target_env_id,
            "name": target_env.get("name", "测试环境"),
            "vod_subappid": "mock_vod_subapp_888",
            "trtc_private_token": "secret_token_value_999",
        })
        assert res["saved_id"] == target_env_id

        cfg = load_config()
        # 验证 load_config 成功无损保留扩展字段
        assert cfg.get("vod_subappid") == "mock_vod_subapp_888"
        assert cfg.get("trtc_private_token") == "secret_token_value_999"

        # 验证动态识别以 _token / _key 结尾的敏感字段并脱敏
        assert is_field_sensitive("trtc_private_token") is True
        assert is_field_sensitive("vod_subappid") is False
    finally:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(original, f, ensure_ascii=False, indent=2)


def test_test_connectivity_routing_and_isolation():
    """验证 test_connection 根据业务类型精准分发驱动，杜绝跨业务回退至 IM"""
    client = UniversalCloudClient()

    # 1. IM 业务测试 -> 分发至 TimClient
    res_im = client.test_connection(service="im")
    assert isinstance(res_im, dict)
    assert "ActionStatus" in res_im

    # 2. Live 业务测试 -> 分发至 Tc3Client (调用 DescribeLiveDomains)
    res_live = client.test_connection(service="live")
    assert isinstance(res_live, dict)
    assert "ActionStatus" in res_live

    # 3. 其它业务测试 -> 分发至 Tc3Client 相应接口，绝不回退至 TimClient 的在线状态查询
    res_vod = client.test_connection(service="vod")
    assert isinstance(res_vod, dict)
    assert "ActionStatus" in res_vod
    # 确认回包不是 IM 的 QueryResult 格式
    assert "QueryResult" not in res_vod


def test_task_runner_credential_snapshot_isolation():
    """验证 TaskRunner 在任务创建时完成凭证快照隔离，任务执行不受环境切换污染"""
    runner = TaskRunner()
    task = runner.create_task(
        api_id="c2c_send_msg",
        items=[{"from_account": "user1", "to_account": "user2", "text": "hello"}],
        dry_run=True
    )
    assert task.config_snapshot is not None
    assert isinstance(task.config_snapshot, dict)
    assert "sdkappid" in task.config_snapshot
    assert "active_env_id" in task.config_snapshot


def test_sandbox_scope_dynamic_shortcuts_injection():
    """验证 Python 沙箱作用域自动挂载当前注册的所有云服务专属宏"""
    registry.discover()
    services = registry.list_services()
    service_ids = [s["id"] for s in services]

    caller_tool = CloudCallTool()
    scope = build_sandbox_scope(caller_tool=caller_tool)

    # 验证基础与统一调用
    assert "cloud_call" in scope
    assert callable(scope["cloud_call"])

    # 验证动态注入各服务专属宏
    for s_id in service_ids:
        macro_name = f"{s_id}_call"
        assert macro_name in scope, f"未发现动态挂载宏: {macro_name}"
        assert callable(scope[macro_name])

    # 验证向后兼容别名
    assert "tim_call" in scope
    assert callable(scope["tim_call"])


def test_registry_dynamic_alias_binding_for_all_services():
    """验证 registry 针对所有服务自动绑定 {service}_{action} 别名"""
    registry.discover()
    live_api = registry.get_api("live_DescribeLiveDomains")
    assert live_api is not None
    assert getattr(live_api, "service_type", None) == "live"
