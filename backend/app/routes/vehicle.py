import re
from fastapi import APIRouter, HTTPException, Request
from app.limiter import limiter
from app.services import dvsa_client, dvla_client
from app import config

router = APIRouter(prefix="/api/v1")

VRN_PATTERN = re.compile(r"^[A-Z0-9]{2,7}$")


def _clean_vrn(vrn: str) -> str:
    return vrn.upper().replace(" ", "")


@router.get("/vehicle/{vrn}")
@limiter.limit("10/minute")
async def lookup_vehicle(request: Request, vrn: str):
    vrn_clean = _clean_vrn(vrn)
    if not VRN_PATTERN.match(vrn_clean):
        raise HTTPException(status_code=422, detail="Invalid VRN format")

    try:
        mot_history = await dvsa_client.get_mot_history(vrn_clean)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"DVSA lookup failed: {exc}") from exc

    vehicle_details = {}
    if config.DVLA_API_KEY:
        try:
            vehicle_details = await dvla_client.get_vehicle_details(vrn_clean)
        except Exception:
            pass  # DVLA enriches the result but is not required for MVP

    return {
        "vrn": vrn_clean,
        "mot_history": mot_history,
        "vehicle_details": vehicle_details,
    }
