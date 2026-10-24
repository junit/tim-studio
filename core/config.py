# -*- coding: utf-8 -*-
"""
多环境与鉴权配置管理器
支持多环境隔离、标签打标、备注说明、密钥脱敏保护及防覆盖机制
"""

import json
import os
import uuid

CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config.json"))

DEFAULT_ENV = {
    "id": "env_default",
    "name": "示例开发环境",
    "tag": "DEV",
    "remark": "请在「环境配置」中填入腾讯云控制台对应的 SDKAppID 和 SecretKey",
    "sdkappid": 1400000000,
    "secret_key": "YOUR_SECRET_KEY_HERE",
    "admin_user": "administrator",
    "domain": "console.tim.qq.com",
    "delay_sec": 0.05,
}


def mask_secret(secret: str) -> str:
    """密钥脱敏处理：保留前4位和后4位，中间星号脱敏"""
    if not secret:
        return ""
    if len(secret) <= 8:
        return "******"
    return secret[:4] + "*" * min(32, len(secret) - 8) + secret[-4:]


def is_secret_masked(secret: str) -> bool:
    """检查是否为脱敏字符串，用于防止前端提交的脱敏掩码覆盖真实密钥"""
    if not secret:
        return False
    return "*" in secret or "•" in secret or secret.startswith("...")


def load_raw_config() -> dict:
    """读取未经处理的原始配置"""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:
            print(f"[WARN] Failed to load config.json: {e}")
    return {}


def load_config() -> dict:
    """读取配置并格式化多环境，向下兼容根层级字段"""
    raw = load_raw_config()
    environments = raw.get("environments", [])

    # 如果历史配置文件中没有 environments 列表，则自动迁移升级
    if not environments or not isinstance(environments, list):
        initial_env = dict(DEFAULT_ENV)
        if "sdkappid" in raw and raw["sdkappid"]:
            initial_env["sdkappid"] = raw["sdkappid"]
        if "secret_key" in raw and raw["secret_key"]:
            initial_env["secret_key"] = raw["secret_key"]
        if "admin_user" in raw and raw["admin_user"]:
            initial_env["admin_user"] = raw["admin_user"]
        if "domain" in raw and raw["domain"]:
            initial_env["domain"] = raw["domain"]
        if "delay_sec" in raw:
            initial_env["delay_sec"] = raw["delay_sec"]
        environments = [initial_env]

    active_id = raw.get("active_env_id")
    active_env = next((e for e in environments if e.get("id") == active_id), None)
    if not active_env:
        active_env = environments[0]
        active_id = active_env.get("id", "env_default")

    # 构建并同步根配置
    cfg = {
        "active_env_id": active_id,
        "environments": environments,
        "sdkappid": active_env.get("sdkappid", 0),
        "secret_key": active_env.get("secret_key", ""),
        "admin_user": active_env.get("admin_user", "administrator"),
        "domain": active_env.get("domain", "console.tim.qq.com"),
        "delay_sec": active_env.get("delay_sec", 0.05),
    }
    return cfg


def save_config(new_config: dict) -> dict:
    """持久化保存配置到 config.json (只保存 active_env_id 与 environments，无冗余字段)"""
    disk_data = {
        "active_env_id": new_config.get("active_env_id", "env_default"),
        "environments": new_config.get("environments", []),
    }
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(disk_data, f, ensure_ascii=False, indent=2)
    return new_config


def get_environments_payload(mask: bool = True) -> dict:
    """获取所有环境列表与当前活动环境（支持密钥脱敏）"""
    cfg = load_config()
    envs = []
    for e in cfg["environments"]:
        item = dict(e)
        real_key = item.get("secret_key", "")
        item["has_secret"] = bool(real_key)
        if mask:
            item["secret_key"] = mask_secret(real_key)
        envs.append(item)

    active_env = next((e for e in envs if e.get("id") == cfg["active_env_id"]), envs[0] if envs else None)
    return {
        "active_env_id": cfg["active_env_id"],
        "active_env": active_env,
        "environments": envs,
    }


def switch_environment(env_id: str) -> dict:
    """切换当前活动环境"""
    cfg = load_config()
    target_env = next((e for e in cfg["environments"] if e.get("id") == env_id), None)
    if not target_env:
        raise ValueError(f"环境 ID {env_id} 不存在")

    cfg["active_env_id"] = env_id
    save_config(cfg)
    return get_environments_payload(mask=True)


def save_environment(env_data: dict) -> dict:
    """
    新建或更新单项环境配置
    关键安全特性：如果提交的 secret_key 为空或为脱敏掩码（包含星号），则保留原真实密钥不变！
    """
    cfg = load_config()
    env_id = env_data.get("id")
    is_new = False

    if not env_id:
        env_id = f"env_{uuid.uuid4().hex[:8]}"
        env_data["id"] = env_id
        is_new = True

    existing_idx = next((i for i, e in enumerate(cfg["environments"]) if e.get("id") == env_id), -1)

    submitted_key = str(env_data.get("secret_key", "")).strip()

    if existing_idx >= 0:
        existing_env = cfg["environments"][existing_idx]
        # 防覆盖逻辑：未变更密钥时（为空或含星号掩码），保留数据库中的真实密钥
        if not submitted_key or is_secret_masked(submitted_key):
            env_data["secret_key"] = existing_env.get("secret_key", "")
        else:
            env_data["secret_key"] = submitted_key

        cfg["environments"][existing_idx] = {
            **existing_env,
            **env_data,
        }
    else:
        # 新建环境
        if is_secret_masked(submitted_key):
            env_data["secret_key"] = ""
        cfg["environments"].append(env_data)

    # 如果当前创建的是第一个环境，自动设为活动环境
    if is_new and len(cfg["environments"]) == 1:
        cfg["active_env_id"] = env_id

    save_config(cfg)
    payload = get_environments_payload(mask=True)
    saved_env = next((e for e in payload["environments"] if e.get("id") == env_id), None)
    return {
        **payload,
        "saved_env": saved_env,
        "saved_id": env_id,
    }


def delete_environment(env_id: str) -> dict:
    """删除环境（至少保留一个环境）"""
    cfg = load_config()
    if len(cfg["environments"]) <= 1:
        raise ValueError("至少需要保留一个环境配置，无法全部删除")

    cfg["environments"] = [e for e in cfg["environments"] if e.get("id") != env_id]

    if cfg["active_env_id"] == env_id:
        cfg["active_env_id"] = cfg["environments"][0]["id"]

    save_config(cfg)
    return get_environments_payload(mask=True)
