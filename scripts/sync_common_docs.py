#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
腾讯云 API 3.0 公共文档与标准规范同步命令行工具
用法：
  python3 scripts/sync_common_docs.py
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.common_specs_syncer import common_specs_manager


def main():
    print("=" * 60)
    print("腾讯云 API 3.0 公共规范同步器 (Live CSS &通用 v3 规范)")
    print("=" * 60)
    specs = common_specs_manager.sync_all()

    print("\n--- 同步结果统计 ---")
    print(f"服务名称: {specs.get('service_name')} ({specs.get('service')})")
    print(f"更新时间: {specs.get('updated_at')}")
    print(f"调用方式规范: {list(specs.get('invocation', {}).keys())}")
    print(f"数据结构数量: {specs.get('structs', {}).get('total_count', 0)}")
    print(f"错误码数量: {specs.get('errors', {}).get('total_count', 0)}")
    print(f"映射表条目: 国家/地区 {specs.get('mappings', {}).get('countries_count', 0)} 个, "
          f"省份 {specs.get('mappings', {}).get('provinces_count', 0)} 个, "
          f"运营商 {specs.get('mappings', {}).get('isps_count', 0)} 个")
    print("\n[OK] 同步完成，所有规范已结构化入库并在系统内生效。")


if __name__ == "__main__":
    main()
