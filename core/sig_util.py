# -*- coding: utf-8 -*-
"""
UserSig (TLSSigAPIv2) 生成与缓存工具
"""

import base64
import hashlib
import hmac
import json
import time
import zlib

_sig_cache = {}


def gen_user_sig(sdkappid: int, key: str, identifier: str, expire: int = 86400 * 7) -> str:
    """
    生成腾讯云 IM UserSig (TLSSigAPIv2)，内置内存缓存
    """
    cache_key = (sdkappid, key, identifier)
    curr_time = int(time.time())
    if cache_key in _sig_cache:
        cached_sig, gen_time, exp = _sig_cache[cache_key]
        # 缓存有效期还剩 1 小时以上直接复用
        if curr_time < gen_time + exp - 3600:
            return cached_sig

    sig_doc = {
        "TLS.ver": "2.0",
        "TLS.identifier": str(identifier),
        "TLS.sdkappid": int(sdkappid),
        "TLS.expire": int(expire),
        "TLS.time": curr_time,
    }
    base_content = (
        f"TLS.identifier:{identifier}\n"
        f"TLS.sdkappid:{sdkappid}\n"
        f"TLS.time:{curr_time}\n"
        f"TLS.expire:{expire}\n"
    )
    sig = hmac.new(key.encode("utf-8"), base_content.encode("utf-8"), hashlib.sha256).digest()
    sig_doc["TLS.sig"] = base64.b64encode(sig).decode("utf-8")

    compressed = zlib.compress(json.dumps(sig_doc).encode("utf-8"))
    base64_str = base64.b64encode(compressed).decode("utf-8")
    user_sig = base64_str.replace("+", "*").replace("/", "-").replace("=", "_")

    _sig_cache[cache_key] = (user_sig, curr_time, expire)
    return user_sig
