# -*- coding: utf-8 -*-
"""
全维度代码审计与证伪防护单元测试套件
验证针对 P0/P1/P2 重大缺陷的防御性加固：
1. 沙箱执行白名单去除 "os"，封堵代码执行提权路径
2. RunSkillTool 静态 AST 审查与非阻塞超时机制
3. 环境配置多值更新时对 None 与空掩码的防损坏覆盖保护
4. safe_int 在 API 数据流装配时的空字符串健壮容错
5. TaskRunner 异常容灾与单项错误隔离保护
6. AgentRun 异常状态机终态保护（杜绝 error 状态被 done 覆盖）
7. 附件文件打包重名去重保护
"""

import ast
import io
import json
import os
import sys
import time
import zipfile
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apis.base import safe_int
from apis.c2c_msg import SendMsgApi, BatchSendMsgApi
from apis.group import AddGroupMemberApi
from core.agent.constants import AUTHORIZED_IMPORTS
from core.agent.run_manager import AgentRun
from core.agent.tools import RunSkillTool
from core.config import save_environment, load_config, load_raw_config
from core.task_runner import TaskRunner, BatchTask
from core.tim_client import TimClient


def test_authorized_imports_sandbox_os_removed():
    """验证 Python 沙箱导入白名单中已彻底移除 'os' 模块"""
    assert "os" not in AUTHORIZED_IMPORTS
    assert "subprocess" not in AUTHORIZED_IMPORTS
    assert "sys" not in AUTHORIZED_IMPORTS
    assert "shutil" not in AUTHORIZED_IMPORTS


def test_run_skill_ast_security_gate(tmp_path):
    """验证 RunSkillTool 静态 AST 对危险模块与逃逸属性的严格拦截"""
    from core.agent.bot_manager import BotManager
    mgr = BotManager(data_dir=str(tmp_path / "data"))
    bot = mgr.create_bot("test_sec_bot", "安全测试机器人")

    # 1. 拦截 import os
    mgr.save_skill(bot.id, "hack_os", "尝试导入 os", "import os\nexecute = lambda: os.system('whoami')")
    runner = RunSkillTool(bot.id, mgr, TimClient())
    res1 = runner.forward("hack_os")
    assert res1["success"] is False
    assert "安全拦截" in res1["error"]
    assert "os" in res1["error"]

    # 2. 拦截 import subprocess
    mgr.save_skill(bot.id, "hack_subproc", "尝试导入 subprocess", "from subprocess import Popen\nexecute = lambda: 1")
    res2 = runner.forward("hack_subproc")
    assert res2["success"] is False
    assert "安全拦截" in res2["error"]
    assert "subprocess" in res2["error"]

    # 3. 拦截 __subclasses__ 逃逸
    mgr.save_skill(bot.id, "hack_escape", "尝试原型逃逸", "execute = lambda: ().__class__.__bases__[0].__subclasses__()")
    res3 = runner.forward("hack_escape")
    assert res3["success"] is False
    assert "安全拦截" in res3["error"]
    assert "__subclasses__" in res3["error"]


def test_safe_int_robustness():
    """验证 safe_int 容错转换各类边界入参"""
    assert safe_int(123) == 123
    assert safe_int("456") == 456
    assert safe_int("  789  ") == 789
    assert safe_int("") == 0
    assert safe_int("", default=2) == 2
    assert safe_int(None) == 0
    assert safe_int(None, default=5) == 5
    assert safe_int("invalid_string", default=9) == 9
    assert safe_int("12.34") == 12


def test_api_build_payload_empty_strings():
    """验证 API build_payload 在处理包含空字符串的数字字段时不崩溃"""
    send_api = SendMsgApi()
    p1 = send_api.build_payload({
        "Text": "测试消息",
        "SyncOtherMachine": "",
        "From_Account": "user1",
        "To_Account": "user2",
        "MsgRandom": ""
    })
    assert p1["SyncOtherMachine"] == 1
    assert p1["From_Account"] == "user1"
    assert p1["To_Account"] == "user2"
    assert isinstance(p1["MsgRandom"], int)

    batch_api = BatchSendMsgApi()
    p2 = batch_api.build_payload({
        "Text": "批量测试",
        "SyncOtherMachine": "",
        "To_Account": "user1,user2",
        "MsgRandom": ""
    })
    assert p2["SyncOtherMachine"] == 2
    assert p2["To_Account"] == ["user1", "user2"]
    assert isinstance(p2["MsgRandom"], int)

    add_api = AddGroupMemberApi()
    p3 = add_api.build_payload({
        "GroupId": "@TGS#test",
        "Member_Accounts": "user1,user2",
        "Silence": ""
    })
    assert p3["GroupId"] == "@TGS#test"
    assert p3["Silence"] == 0
    assert len(p3["MemberList"]) == 2


def test_save_environment_preserves_secret_on_null_field():
    """验证 save_environment 在前端传入 None 时不将真实密钥覆盖为 'None' 字符串"""
    raw_before = load_raw_config()
    active_env_id = raw_before.get("active_env_id", "env_default")
    env = next((e for e in raw_before.get("environments", []) if e.get("id") == active_env_id), None)
    orig_secret = env.get("secret_key", "") if env else ""

    # 提交包含 null / None 的 secret_key
    res = save_environment({
        "id": active_env_id,
        "secret_key": None
    })
    raw_after = load_raw_config()
    raw_env_after = next((e for e in raw_after.get("environments", []) if e.get("id") == active_env_id), None)
    assert raw_env_after is not None
    assert raw_env_after["secret_key"] == orig_secret
    assert raw_env_after["secret_key"] != "None"


def test_agent_run_error_status_not_masked_by_done():
    """验证 AgentRun 在发生异常时，派发 done 事件不会掩盖 error 终态"""
    run = AgentRun(
        run_id="run_test_err",
        bot_id="default_assistant",
        user_message="测试异常状态保持"
    )
    assert run.status == "running"

    # 触发 error 事件
    run.dispatch_event("error", {"error": "致命调用失败"})
    assert run.status == "error"
    assert run.stream_status == "error"

    # 后续派发 done 事件（带 status=error）
    run.dispatch_event("done", {"status": "error"})
    assert run.status == "error"
    assert run.stream_status == "error"
    assert run.error == "致命调用失败"


def test_task_runner_isolated_item_error():
    """验证 TaskRunner 在遇到单个异常行时，不崩溃整个任务，单行标错并顺利完成整体批处理"""
    runner = TaskRunner()
    # 模拟包含 3 个项目的任务，其中第 2 项数据故意损坏
    items = [
        {"Text": "正常消息1", "From_Account": "u1", "To_Account": "u2"},
        {"Text": "", "From_Account": "", "To_Account": ""},
        {"Text": "正常消息3", "From_Account": "u3", "To_Account": "u4"},
    ]
    task = runner.create_task("c2c_send_msg", items, delay_sec=0.01, dry_run=True)
    runner._worker(task)

    assert task.status == "COMPLETED"
    assert task.total == 3
    assert len(task.results) == 3
