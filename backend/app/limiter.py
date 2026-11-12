from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip(request: Request) -> str:
    # Render sits behind Cloudflare, so request.client is the proxy and every visitor would share
    # one rate-limit bucket. Cloudflare overwrites CF-Connecting-IP, so clients can't spoof it.
    return request.headers.get("cf-connecting-ip") or get_remote_address(request)


limiter = Limiter(key_func=client_ip)
