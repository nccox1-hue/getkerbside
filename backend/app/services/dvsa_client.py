import time
import httpx
from app import config


class _TokenCache:
    access_token: str = ""
    expires_at: float = 0.0


_cache = _TokenCache()


async def _get_token() -> str:
    # Refresh 60 seconds before expiry to avoid edge-case failures
    if _cache.access_token and time.time() < _cache.expires_at - 60:
        return _cache.access_token

    async with httpx.AsyncClient() as client:
        response = await client.post(
            config.DVSA_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": config.DVSA_CLIENT_ID,
                "client_secret": config.DVSA_CLIENT_SECRET,
                "scope": config.DVSA_SCOPE,
            },
        )
        response.raise_for_status()
        data = response.json()

    _cache.access_token = data["access_token"]
    _cache.expires_at = time.time() + data.get("expires_in", 3600)
    return _cache.access_token


async def get_mot_history(vrn: str) -> dict:
    token = await _get_token()
    url = f"{config.DVSA_BASE_URL}/trade/vehicles/registration/{vrn}"

    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "X-Api-Key": config.DVSA_API_KEY,
            },
        )
        response.raise_for_status()
        return response.json()
