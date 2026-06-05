import httpx
from app import config


async def get_vehicle_details(vrn: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            config.DVLA_BASE_URL,
            json={"registrationNumber": vrn},
            headers={
                "x-api-key": config.DVLA_API_KEY,
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        return response.json()
