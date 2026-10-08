"""Which servers browsers should use to find each other for WebRTC.

STUN lets a browser learn its public address; that is enough when at least
one side's router is friendly. When both are behind strict routers (phone data,
many home and office networks), the video has to go through a TURN relay.
TURN logins come from the server, not the frontend code, so they are not
baked into the public JavaScript, and Cloudflare's are short lived.
"""

import json
import logging
import time
import urllib.error
import urllib.request

from app import config

log = logging.getLogger(__name__)

STUN = {"urls": ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"]}
CREDENTIAL_TTL = 24 * 3600  # how long a Cloudflare TURN login lasts
_cache: dict = {"servers": None, "until": 0.0}


def _cloudflare() -> list[dict] | None:
    """Short lived TURN logins from Cloudflare, reused for an hour."""
    if _cache["servers"] and time.time() < _cache["until"]:
        return _cache["servers"]
    base = f"https://rtc.live.cloudflare.com/v1/turn/keys/{config.CLOUDFLARE_TURN_KEY_ID}/credentials"
    for path in ("generate-ice-servers", "generate"):
        req = urllib.request.Request(
            f"{base}/{path}",
            data=json.dumps({"ttl": CREDENTIAL_TTL}).encode(),
            headers={
                "Authorization": f"Bearer {config.CLOUDFLARE_TURN_API_TOKEN}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                body = json.load(res)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                continue  # older API: try the other path
            log.warning("Cloudflare TURN request failed: %s", e)
            return None
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            log.warning("Cloudflare TURN request failed: %s", e)
            return None
        servers = body.get("iceServers")
        if isinstance(servers, dict):
            servers = [servers]
        if servers:
            _cache.update(servers=servers, until=time.time() + 3600)
            return servers
    return None


def ice_servers() -> list[dict]:
    servers: list[dict] = [STUN]
    if config.CLOUDFLARE_TURN_KEY_ID and config.CLOUDFLARE_TURN_API_TOKEN:
        servers += _cloudflare() or []
    if config.TURN_URLS:
        servers.append({"urls": config.TURN_URLS, "username": config.TURN_USERNAME, "credential": config.TURN_CREDENTIAL})
    return servers


def has_relay(servers: list[dict]) -> bool:
    def urls(s: dict) -> list[str]:
        u = s.get("urls", [])
        return [u] if isinstance(u, str) else list(u)

    return any(url.startswith(("turn:", "turns:")) for s in servers for url in urls(s))
