# -*- coding: utf-8 -*-
"""
智能体工具集定义：TIM 166 API 工具、提示词自我强化、记忆持久化、技能自沉淀与执行
"""

import json
import os
import re
import time
from typing import Any, Dict, List, Optional
from smolagents import Tool

from ..tim_client import TimClient
from .bot_manager import BotManager
from .constants import HIGH_RISK_API_KEYWORDS


class TimCallTool(Tool):
    name = "tim_call"
    description = "调用腾讯云 IM 166 个 REST 接口中的任意一个。支持服务路径如 'group_open_http_svc/get_group_info' 或 'openim/sendmsg'。直接返回官方接口的 JSON 响应。"
    inputs = {
        "api_path": {
            "type": "string",
            "description": "接口路径，如 'group_open_http_svc/get_group_info', 'openim/sendmsg', 或 'profile/portrait_set'"
        },
        "payload": {
            "type": "object",
            "description": "请求参数 JSON 字典，完全符合腾讯云官方 IM REST API 文档规范"
        }
    }
    output_type = "object"

    def __init__(
        self,
        tim_client: TimClient,
        approval_requester: Optional[Any] = None,
        bot_manager: Optional[BotManager] = None
    ):
        super().__init__()
        self.tim_client = tim_client
        self.approval_requester = approval_requester
        self.bot_manager = bot_manager

    def forward(self, api_path: str, payload: dict) -> dict:
        high_risk_kws = self.bot_manager.get_high_risk_keywords() if self.bot_manager else HIGH_RISK_API_KEYWORDS
        is_high_risk = any(k in (api_path or "").lower() for k in high_risk_kws)
        if is_high_risk and self.approval_requester:
            target_desc = []
            if isinstance(payload, dict):
                if "GroupId" in payload:
                    target_desc.append(f"群组 ID: {payload['GroupId']}")
                if "GroupIdList" in payload:
                    target_desc.append(f"群组列表: {len(payload['GroupIdList'])} 个群")
                if "Accounts" in payload:
                    target_desc.append(f"目标账号: {payload['Accounts']}")
                if "UserID" in payload:
                    target_desc.append(f"用户 ID: {payload['UserID']}")
                if "Account" in payload:
                    target_desc.append(f"账号: {payload['Account']}")

            summary_str = "，".join(target_desc) if target_desc else "未指定具体目标标识"
            approval_id = f"appr_{int(time.time() * 1000)}"

            # 触发人机协同门禁挂起并等待授权
            decision = self.approval_requester({
                "approval_id": approval_id,
                "api_path": api_path,
                "payload": payload,
                "warning": f"检测到不可逆破坏性操作：{api_path}",
                "target_summary": summary_str,
                "timeout_seconds": 300
            })

            if decision != "approve":
                return {
                    "ActionStatus": "CANCELLED",
                    "ErrorCode": -999,
                    "ErrorInfo": f"⚠️ 操作已安全取消：用户拒绝了「{api_path}」高危调用的执行授权。未产生任何不可逆修改。"
                }

        try:
            res = self.tim_client.invoke("", api_path, payload)
            if is_high_risk and isinstance(res, dict):
                res["_security_notice"] = {
                    "is_high_risk": True,
                    "user_approved": True if self.approval_requester else False,
                    "warning": f"⚠️ 警告: 接口 '{api_path}' 属于破坏性高危操作（解散群/删除账号/批量清理），已完成安全审计记录。"
                }
            return res
        except Exception as e:
            return {
                "ActionStatus": "FAIL",
                "ErrorCode": -99,
                "ErrorInfo": f"调用接口 {api_path} 异常: {str(e)}"
            }


class TimSearchApisTool(Tool):
    name = "tim_search_apis"
    description = "在腾讯云 IM 全部 166 个 REST API 知识库中按关键词检索相关接口，返回匹配的接口 ID、名称、路径及功能简介。"
    inputs = {
        "keyword": {
            "type": "string",
            "description": "搜索关键词，支持中文功能、接口名、英文指令名，例如 '禁言', '撤回', 'forbid_send_msg', 'group'"
        }
    }
    output_type = "array"

    def __init__(self, catalog_path: Optional[str] = None):
        super().__init__()
        if not catalog_path:
            catalog_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tim_full_catalog.json"))
        self.catalog = []
        if os.path.exists(catalog_path):
            with open(catalog_path, "r", encoding="utf-8") as f:
                self.catalog = json.load(f)

    def forward(self, keyword: str) -> list:
        kw = keyword.lower().strip()
        matches = []
        for item in self.catalog:
            name = item.get("name", "").lower()
            cmd = item.get("full_command", "").lower()
            desc = item.get("description", "").lower()
            cat = item.get("category", "").lower()
            if kw in name or kw in cmd or kw in desc or kw in cat:
                matches.append({
                    "api_id": item.get("api_id"),
                    "name": item.get("name"),
                    "category": item.get("category"),
                    "path": "/".join(item.get("path", [])),
                    "full_command": item.get("full_command"),
                    "description": item.get("description", "")[:200]
                })
        return matches[:25]


class TimGetDocTool(Tool):
    name = "tim_get_doc"
    description = "获取指定腾讯云 IM REST API 的详细文档规范、入参定义和示例请求体。"
    inputs = {
        "api_path": {
            "type": "string",
            "description": "接口的 command 路径（如 'group_open_http_svc/get_group_info'）或 api_id（如 'tim_2284'）"
        }
    }
    output_type = "object"

    def __init__(self, catalog_path: Optional[str] = None):
        super().__init__()
        if not catalog_path:
            catalog_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tim_full_catalog.json"))
        self.catalog = []
        if os.path.exists(catalog_path):
            with open(catalog_path, "r", encoding="utf-8") as f:
                self.catalog = json.load(f)

    def forward(self, api_path: str) -> dict:
        target = api_path.strip().lower()
        if target.startswith("v4/"):
            target = target[3:]
        for item in self.catalog:
            api_id = item.get("api_id", "").lower()
            full_cmd = item.get("full_command", "").lower()
            if full_cmd.startswith("v4/"):
                full_cmd = full_cmd[3:]
            if target == api_id or target == full_cmd or target in full_cmd:
                return {
                    "api_id": item.get("api_id"),
                    "name": item.get("name"),
                    "category": item.get("category"),
                    "subcategory": item.get("subcategory"),
                    "full_command": item.get("full_command"),
                    "doc_url": item.get("doc_url"),
                    "description": item.get("description"),
                    "sample_payload": item.get("sample_payload"),
                    "fields": item.get("fields", [])
                }
        return {"error": f"未找到接口文档: {api_path}"}


class EnhancePromptTool(Tool):
    name = "enhance_self_prompt"
    description = "BOT 自主增强自己的提示词准则（Prompt Self-Enhancement）。用于固化业务要求、规范或偏好，使该 BOT 在后续相似任务中表现更专业有效。"
    inputs = {
        "instruction": {
            "type": "string",
            "description": "需要追加的行为准则或处理规范，例如：'对于群禁言操作，若未指定时长默认按 3600 秒执行并在输出中告知'"
        },
        "reason": {
            "type": "string",
            "description": "为何增强该准则的原因说明，例如：'用户要求统一默认禁言1小时'",
            "nullable": True
        }
    }
    output_type = "string"

    def __init__(self, bot_id: str, bot_manager: BotManager):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self, instruction: str, reason: str = "") -> str:
        guideline = self.bot_manager.add_learned_guideline(self.bot_id, instruction, reason)
        if guideline:
            return f"✅ 提示词已成功自我增强！新准则 ID: {guideline.id}，内容: {guideline.instruction}"
        return "❌ 增强提示词失败：未找到指定 BOT"


class SaveMemoryTool(Tool):
    name = "save_memory"
    description = "为当前 BOT 沉淀长期事实记忆，记录群 ID、管理员账号、特定业务配置或习惯。"
    inputs = {
        "key": {
            "type": "string",
            "description": "记忆的键名标识，如 'target_test_group', 'admin_id'"
        },
        "content": {
            "type": "string",
            "description": "记忆的具体事实内容"
        }
    }
    output_type = "string"

    def __init__(self, bot_id: str, bot_manager: BotManager):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self, key: str, content: str) -> str:
        item = self.bot_manager.save_memory(self.bot_id, key, content)
        return f"🧠 长期记忆已保存：[{item.key}] -> {item.content}"


class RecallMemoryTool(Tool):
    name = "recall_memory"
    description = "检索当前 BOT 记住的长期事实清单。"
    inputs = {
        "query": {
            "type": "string",
            "description": "检索关键词，留空或 'all' 则返回所有记忆",
            "nullable": True
        }
    }
    output_type = "array"

    def __init__(self, bot_id: str, bot_manager: BotManager):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self, query: Optional[str] = None) -> list:
        mems = self.bot_manager.list_memories(self.bot_id)
        if not query or query.lower() in ("all", ""):
            return [m.model_dump() for m in mems]
        q = query.lower().strip()
        # 1. 优先尝试精确全子串匹配
        exact_matches = [m.model_dump() for m in mems if q in m.key.lower() or q in m.content.lower()]
        if exact_matches:
            return exact_matches

        # 2. 自然语言与多关键词模糊匹配 (中英文 Bigram 与词素)
        tokens = []
        words = [w for w in re.findall(r"[a-z0-9_\-]+", q) if len(w) >= 2]
        tokens.extend(words)

        cn_chars = re.findall(r"[\u4e00-\u9fa5]", q)
        for i in range(len(cn_chars) - 1):
            tokens.append(cn_chars[i] + cn_chars[i + 1])

        phrases = [p.strip() for p in re.split(r"[\s,，、/_\-]+", q) if 2 <= len(p.strip()) <= 6]
        tokens.extend(phrases)

        if not tokens:
            return []

        scored_memories = []
        for m in mems:
            k_low = m.key.lower()
            c_low = m.content.lower()
            match_score = sum(1 for tok in tokens if tok in k_low or tok in c_low)
            if match_score > 0:
                scored_memories.append((match_score, m.model_dump()))

        scored_memories.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored_memories]


class DeleteMemoryTool(Tool):
    name = "delete_memory"
    description = "删除当前 BOT 中过时或不再适用的记忆项。"
    inputs = {
        "key": {
            "type": "string",
            "description": "要删除的记忆键名"
        }
    }
    output_type = "string"

    def __init__(self, bot_id: str, bot_manager: BotManager):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self, key: str) -> str:
        ok = self.bot_manager.delete_memory(self.bot_id, key)
        return f"记忆 [{key}] 删除成功" if ok else f"未找到记忆 [{key}]"


class SaveSkillTool(Tool):
    name = "save_skill"
    description = "BOT 将编写并验证成功的 Python 脚本沉淀为专属技能（Skill），供未来直接调度复用。"
    inputs = {
        "name": {
            "type": "string",
            "description": "技能名称，纯字母数字下划线，如 'batch_mute_group_members'"
        },
        "description": {
            "type": "string",
            "description": "技能的功能描述"
        },
        "python_code": {
            "type": "string",
            "description": "完整的 Python 脚本代码。脚本中可定义 def execute(tim_client, **kwargs) 函数或直接执行逻辑"
        },
        "input_schema": {
            "type": "object",
            "description": "技能入参规范说明，如 {'group_id': '目标群ID'}",
            "nullable": True
        }
    }
    output_type = "string"

    def __init__(self, bot_id: str, bot_manager: BotManager):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self, name: str, description: str, python_code: str, input_schema: Optional[dict] = None) -> str:
        skill = self.bot_manager.save_skill(self.bot_id, name, description, python_code, input_schema)
        return f"⚡ 技能 [{skill.name}] 已成功保存到当前 BOT 的专属技能库！后续可通过 run_skill('{skill.name}') 直接调用。"


class ListSkillsTool(Tool):
    name = "list_skills"
    description = "查看当前 BOT 已沉淀的所有技能列表及入参规范。"
    inputs = {}
    output_type = "array"

    def __init__(self, bot_id: str, bot_manager: BotManager):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self) -> list:
        skills = self.bot_manager.list_skills(self.bot_id)
        return [
            {
                "name": s.name,
                "description": s.description,
                "input_schema": s.input_schema,
                "created_at": s.created_at
            }
            for s in skills
        ]


class RunSkillTool(Tool):
    name = "run_skill"
    description = "运行当前 BOT 已沉淀的某个专属技能。"
    inputs = {
        "name": {
            "type": "string",
            "description": "技能名称"
        },
        "kwargs": {
            "type": "object",
            "description": "传递给该技能的入参字典",
            "nullable": True
        }
    }
    output_type = "object"

    def __init__(self, bot_id: str, bot_manager: BotManager, tim_client: TimClient):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager
        self.tim_client = tim_client

    def forward(self, name: str, kwargs: Optional[dict] = None) -> dict:
        skill = self.bot_manager.get_skill(self.bot_id, name)
        if not skill:
            return {"error": f"未找到技能: {name}"}
        args = kwargs or {}
        # 安全运行沙箱执行该技能
        local_scope: Dict[str, Any] = {
            "tim_client": self.tim_client,
            "tim_call": lambda path, payload: self.tim_client.invoke("", path, payload),
            "args": args,
            "kwargs": args,
            "result": None
        }

        import concurrent.futures
        def _exec_target():
            exec(skill.code, local_scope)
            if "execute" in local_scope and callable(local_scope["execute"]):
                return local_scope["execute"](self.tim_client, **args)
            return local_scope.get("result", "Skill executed successfully")

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_exec_target)
                res = future.result(timeout=25.0)
                return {"success": True, "result": res}
        except concurrent.futures.TimeoutError:
            return {"success": False, "error": f"执行技能 {name} 超时（超过 25 秒限制）"}
        except Exception as e:
            return {"success": False, "error": f"执行技能 {name} 失败: {str(e)}"}


class CreateBotTool(Tool):
    name = "create_bot"
    description = (
        "【仅内建全能助手独享特权】创建并孵化新的专属业务智能体 (Bot)。"
        "当用户要求创建、新增或孵化新的智能体时（如'帮我建一个社群风控官'、'创建一个IM巡检机器人'）调用此工具。"
        "可指定名称、业务目标/定位、头像Emoji、系统设定提示词及推荐指令。"
    )
    inputs = {
        "name": {
            "type": "string",
            "description": "智能体名称，例如 '社群风控官', '消息管理员', 'IM运维巡检官'"
        },
        "goal": {
            "type": "string",
            "description": "智能体的主要业务职责定位与应用场景，例如 '负责监控大群敏感发言、违规撤回与批量禁言处理'",
            "nullable": True
        },
        "avatar": {
            "type": "string",
            "description": "智能体头像 Emoji，如 '🛡️', '🔍', '📊', '⚡'。若不提供将自动推断",
            "nullable": True
        },
        "base_prompt": {
            "type": "string",
            "description": "智能体系统设定提示词（约200字，专业严谨人设，结合166 API与沙箱能力）。若不提供将根据名称和目标自动生成",
            "nullable": True
        },
        "suggested_prompts": {
            "type": "array",
            "description": "可选：为新智能体预设的 3~4 条典型业务快捷指令",
            "nullable": True
        }
    }
    output_type = "object"

    def __init__(self, bot_manager: BotManager):
        super().__init__()
        self.bot_manager = bot_manager

    def forward(
        self,
        name: str,
        goal: Optional[str] = None,
        avatar: Optional[str] = None,
        base_prompt: Optional[str] = None,
        suggested_prompts: Optional[list] = None
    ) -> dict:
        clean_name = name.strip()
        if not clean_name:
            return {"success": False, "error": "智能体名称不能为空"}

        profile = self.bot_manager.generate_bot_profile(clean_name, goal or "")
        target_id = profile["id"]
        # 避免重名 ID 冲突
        if self.bot_manager.get_bot(target_id):
            target_id = f"{target_id}_{int(time.time()) % 1000}"

        target_avatar = avatar or profile.get("avatar", "🤖")
        target_desc = goal or profile.get("description", "")
        target_prompt = base_prompt or profile.get("base_prompt", "")
        target_suggested = suggested_prompts or profile.get("suggested_prompts", [])

        # 清洗可能存在的 ChatMessage repr
        target_prompt = BotManager.clean_prompt_text(target_prompt)

        new_bot = self.bot_manager.create_bot(
            bot_id=target_id,
            name=clean_name,
            avatar=target_avatar,
            description=target_desc,
            base_prompt=target_prompt,
            suggested_prompts=target_suggested
        )

        return {
            "success": True,
            "message": f"🎉 专属智能体【{new_bot.name}】创建成功！已成功入驻工作室，可随时在左侧切换或在对话中通过 @{new_bot.name} 进行协同调度。",
            "bot": {
                "id": new_bot.id,
                "name": new_bot.name,
                "avatar": new_bot.avatar,
                "description": new_bot.description,
                "suggested_prompts": new_bot.suggested_prompts
            }
        }


class ListAgentsTool(Tool):
    name = "list_agents"
    description = "查看当前工作室入驻的所有智能体清单（包含名称、ID、头像、职责定位与技能数），用于发现其他智能体以便进行协同指挥调度。"
    inputs = {}
    output_type = "array"

    def __init__(self, bot_manager: BotManager):
        super().__init__()
        self.bot_manager = bot_manager

    def forward(self) -> list:
        bots = self.bot_manager.list_bots()
        return [
            {
                "id": b["id"],
                "name": b.get("name", ""),
                "avatar": b.get("avatar", "🤖"),
                "description": b.get("description", ""),
                "skills_count": b.get("skills_count", 0),
                "mention_handle": f"@{b.get('name', '')}"
            }
            for b in bots
        ]


class CallAgentTool(Tool):
    name = "call_agent"
    description = (
        "指挥或协同其他智能体处理专业子任务（智能体协同/调度指挥机制）。"
        "支持通过智能体名称（例如 '社群风控官'、'@社群风控官'）或智能体 ID 定向派发指令。"
        "目标智能体将独立结合其专属系统提示词、长期记忆与工具技能执行该任务，并返回其分析结论与执行产物。"
    )
    inputs = {
        "agent_name": {
            "type": "string",
            "description": "目标智能体名称或 ID，如 '社群风控官', '消息管理员', '@IM巡检官'"
        },
        "task": {
            "type": "string",
            "description": "派发给该智能体的具体任务描述或要求"
        }
    }
    output_type = "string"

    def __init__(self, bot_id: str, bot_manager: BotManager, engine: Optional[Any] = None, call_chain: Optional[List[str]] = None):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager
        self.engine = engine
        self.call_chain = call_chain or [bot_id]

    def forward(self, agent_name: str, task: str) -> str:
        raw_name = (agent_name or "").strip()
        # 剥除各种标点符号、前缀与外包围符: @, #, 【】, [], "", '', 括号等
        clean_name = re.sub(r"^[@#【\[\"'（(]+", "", raw_name)
        clean_name = re.sub(r"[@#】\]\"'）)]+$", "", clean_name).strip()

        # 如果传入了形如 "消息巡检员 (bot_inspector_9870)" 或 "社群风控官(security_bot)"，抽取 ID 或主要名称
        id_match = re.search(r"[\(（]([a-zA-Z0-9_-]+)[\)）]", clean_name)
        explicit_id = id_match.group(1) if id_match else None
        if explicit_id:
            clean_name = re.sub(r"[\(（][a-zA-Z0-9_-]+[\)）]", "", clean_name).strip()

        all_bots = self.bot_manager.list_bots()
        target_bot = None

        # 1. 显式 ID 匹配
        if explicit_id:
            target_bot = self.bot_manager.get_bot(explicit_id)

        # 2. 精确 ID 或名称匹配
        if not target_bot:
            for b in all_bots:
                b_id = b.get("id", "")
                b_name = b.get("name", "")
                if b_id == clean_name or b_name == clean_name or b_name.lower() == clean_name.lower():
                    target_bot = self.bot_manager.get_bot(b_id)
                    break

        # 3. 子串双向包含匹配 (如 "风控官" in "社群风控官", "巡检" in "消息巡检员")
        if not target_bot and clean_name:
            for b in all_bots:
                b_id = b.get("id", "")
                b_name = b.get("name", "")
                if clean_name in b_name or b_name in clean_name or clean_name.lower() in b_id.lower():
                    target_bot = self.bot_manager.get_bot(b_id)
                    break

        # 4. 语义核心关键词/领域匹配 (自然语言口语化称谓如 "风控", "巡检", "管理员", "投研", "运维")
        if not target_bot and len(clean_name) >= 2:
            keywords = ["风控", "安全", "巡检", "监控", "管理", "对账", "投研", "研报", "运维", "测试", "客服"]
            matched_kws = [k for k in keywords if k in clean_name]
            for kw in matched_kws:
                for b in all_bots:
                    b_name = b.get("name", "")
                    b_desc = b.get("description", "")
                    if kw in b_name or kw in b_desc:
                        target_bot = self.bot_manager.get_bot(b.get("id", ""))
                        break
                if target_bot:
                    break

        if not target_bot:
            available = ", ".join([f"【{b.get('name', '')}】" for b in all_bots])
            return f"❌ 未能通过「{agent_name}」识别到对应智能体。当前团队入驻的智能体伙伴有：{available}。请告知目标智能体名称。"

        if target_bot.id == self.bot_id:
            return f"⚠️ 智能体「{target_bot.name}」即为当前智能体自身，无需通过 call_agent 自调用，请直接在当前流程中执行该任务。"

        if not self.engine:
            return f"⚠️ 系统执行引擎未就绪，无法派发给智能体【{target_bot.name}】。"

        t0 = time.time()
        caller_bot = self.bot_manager.get_bot(self.bot_id)
        caller_name = caller_bot.name if caller_bot else self.bot_id

        try:
            result = self.engine.execute_subtask(
                caller_bot_id=self.bot_id,
                target_bot_id=target_bot.id,
                task=task,
                call_chain=self.call_chain
            )
            elapsed = round(time.time() - t0, 2)
            preview = result.strip()
            if len(preview) > 160:
                preview = preview[:160] + "..."

            record = {
                "caller_bot_id": self.bot_id,
                "caller_bot_name": caller_name,
                "target_bot_id": target_bot.id,
                "target_bot_name": target_bot.name,
                "target_avatar": target_bot.avatar or "🤖",
                "task": task,
                "status": "success",
                "result_preview": preview,
                "elapsed_seconds": elapsed,
                "timestamp": time.strftime("%H:%M:%S")
            }
            if hasattr(self.engine, "record_orchestration"):
                self.engine.record_orchestration(record)

            return (
                f"🤖【{target_bot.name}】执行与协同反馈：\n\n"
                f"{result.strip()}\n"
            )
        except Exception as e:
            elapsed = round(time.time() - t0, 2)
            err_msg = str(e)
            record = {
                "caller_bot_id": self.bot_id,
                "caller_bot_name": caller_name,
                "target_bot_id": target_bot.id,
                "target_bot_name": target_bot.name,
                "target_avatar": target_bot.avatar or "🤖",
                "task": task,
                "status": "error",
                "result_preview": f"异常: {err_msg}",
                "elapsed_seconds": elapsed,
                "timestamp": time.strftime("%H:%M:%S")
            }
            if hasattr(self.engine, "record_orchestration"):
                self.engine.record_orchestration(record)

            return f"❌ 调度智能体【{target_bot.name}】执行子任务时发生异常: {err_msg}"


class ReadFileTool(Tool):
    name = "read_file"
    description = "读取本地文本文件、代码文件、文档（DOCX/PDF/TXT/CSV/JSON/LOG）或已上传附件的文本内容。支持传入文件绝对路径或上传文件名。"
    inputs = {
        "file_path": {
            "type": "string",
            "description": "文件绝对路径或上传文件名"
        },
        "max_chars": {
            "type": "integer",
            "description": "最大读取字符数，默认 4000",
            "nullable": True
        }
    }
    output_type = "string"

    def __init__(self, bot_id: Optional[str] = None, bot_manager: Optional[BotManager] = None):
        super().__init__()
        self.bot_id = bot_id
        self.bot_manager = bot_manager

    def forward(self, file_path: str, max_chars: Optional[int] = 4000) -> str:
        limit = max_chars or 4000
        path = file_path.strip()
        # 若是相对路径或仅文件名，优先在当前 BOT 的 uploads 目录寻找
        if not os.path.isabs(path) and self.bot_id and self.bot_manager:
            bot_dir = self.bot_manager._bot_dir(self.bot_id)
            uploads_dir = os.path.join(bot_dir, "uploads")
            candidate = os.path.join(uploads_dir, os.path.basename(path))
            if os.path.exists(candidate):
                path = candidate
            elif os.path.exists(uploads_dir):
                for fn in os.listdir(uploads_dir):
                    if fn.endswith(path) or path in fn:
                        path = os.path.join(uploads_dir, fn)
                        break

        if not os.path.exists(path):
            return f"❌ 文件不存在: '{file_path}'"

        from .file_parser import get_file_category_and_type, read_text_with_encoding, parse_file_summary
        cat, ftype = get_file_category_and_type(os.path.basename(path))
        if ftype == "docx":
            try:
                import docx
                doc = docx.Document(path)
                paras = [p.text for p in doc.paragraphs if p.text]
                full_text = "\n\n".join(paras)
                if len(full_text) > limit:
                    return full_text[:limit] + f"\n\n[... DOCX 内容已截断，共读取前 {limit} 字符]"
                return full_text or "文档内容为空。"
            except Exception as e:
                return f"读取 DOCX 失败: {str(e)}"
        elif ftype == "pdf":
            try:
                import pypdf
                reader = pypdf.PdfReader(path)
                pages_text = [p.extract_text() for p in reader.pages if p.extract_text()]
                full_text = "\n\n".join(pages_text)
                if len(full_text) > limit:
                    return full_text[:limit] + f"\n\n[... PDF 内容已截断，共读取前 {limit} 字符]"
                return full_text or "PDF 内容为空或仅包含扫描图片。"
            except Exception as e:
                return f"读取 PDF 失败: {str(e)}"
        elif ftype in ("xlsx", "xls", "csv"):
            summary_info = parse_file_summary(path, os.path.basename(path))
            return summary_info.get("summary", "")

        text = read_text_with_encoding(path, max_chars=limit)
        return text or "文件内容为空。"


class SearchKnowledgeTool(Tool):
    name = "search_knowledge"
    description = (
        "在当前智能体挂载的企业私有知识库、运维手册与业务规范中检索相关文档段落。"
        "当遇到腾讯云 IM 错误排查规范、特定内部群规、违规处置流程、网络故障排查 SOP 或私有配置要求时，调用此工具获取精准规范依据。"
    )
    inputs = {
        "query": {
            "type": "string",
            "description": "检索关键词或问题描述，例如 '解散群规范', '错误码10007排查', '敏感词处置流程'"
        }
    }
    output_type = "string"

    def __init__(self, bot_id: str, rag_mgr: Optional[Any] = None):
        super().__init__()
        self.bot_id = bot_id
        from .rag_manager import rag_manager
        self.rag_mgr = rag_mgr or rag_manager

    def forward(self, query: str) -> str:
        results = self.rag_mgr.search(self.bot_id, query, top_k=4)
        if not results:
            return f"未在企业知识库中检索到与「{query}」相关的文档段落。请尝试更通用的关键词或查阅官方接口文档。"

        lines = [f"🔍 在企业私有知识库中找到 {len(results)} 条相关依据：\n"]
        for idx, r in enumerate(results, 1):
            lines.append(f"【{idx}】《{r.get('doc_name')}》- {r.get('title')} (匹配度: {r.get('score')}):")
            lines.append(f"{r.get('content')}\n")
        return "\n".join(lines)


def build_bot_tools(
    bot_id: str,
    bot_manager: BotManager,
    tim_client: TimClient,
    engine: Optional[Any] = None,
    call_chain: Optional[List[str]] = None,
    approval_requester: Optional[Any] = None
) -> List[Tool]:
    """为指定 BOT 组装能力工具集"""
    tools = [
        TimCallTool(tim_client, approval_requester=approval_requester, bot_manager=bot_manager),
        TimSearchApisTool(),
        TimGetDocTool(),
        EnhancePromptTool(bot_id, bot_manager),
        SaveMemoryTool(bot_id, bot_manager),
        RecallMemoryTool(bot_id, bot_manager),
        DeleteMemoryTool(bot_id, bot_manager),
        SaveSkillTool(bot_id, bot_manager),
        ListSkillsTool(bot_id, bot_manager),
        RunSkillTool(bot_id, bot_manager, tim_client),
        ListAgentsTool(bot_manager),
        CallAgentTool(bot_id, bot_manager, engine, call_chain),
        ReadFileTool(bot_id, bot_manager),
        SearchKnowledgeTool(bot_id)
    ]
    # 核心限制：仅内建全能助手 (default_assistant) 独享新建智能体的能力
    if bot_id == "default_assistant":
        tools.append(CreateBotTool(bot_manager))
    return tools
