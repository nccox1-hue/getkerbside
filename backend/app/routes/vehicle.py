import hashlib
import re
import time
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from app.limiter import limiter
from app.services import dvsa_client, dvla_client
from app import config

router = APIRouter(prefix="/api/v1")

VRN_PATTERN = re.compile(r"^[A-Z0-9]{2,7}$")


def _clean_vrn(vrn: str) -> str:
    return vrn.upper().replace(" ", "")


def _vrn_ref(vrn: str) -> str:
    return hashlib.sha256(vrn.encode("utf-8")).hexdigest()[:10]


def _ip_ref(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:8]


def _lookup_failed(vrn_ref: str, ip_ref: str, t0: float) -> HTTPException:
    duration_ms = round((time.monotonic() - t0) * 1000)
    print(
        f"VRM_LOOKUP vrn_ref={vrn_ref} ip_ref={ip_ref} http_status=502 "
        f"error=dvsa_lookup_failed duration_ms={duration_ms} "
        f"timestamp={datetime.now(timezone.utc).isoformat()}"
    )
    return HTTPException(
        status_code=502,
        detail="The MOT records service isn't responding right now. Please try again in a minute.",
    )


@router.get("/vehicle/{vrn}")
@limiter.limit("10/minute")
async def lookup_vehicle(request: Request, vrn: str):
    vrn_clean = _clean_vrn(vrn)
    vrn_ref = _vrn_ref(vrn_clean)
    ip_ref = _ip_ref(request)
    t0 = time.monotonic()

    if not VRN_PATTERN.match(vrn_clean):
        print(
            f"VRM_LOOKUP vrn_ref={vrn_ref} ip_ref={ip_ref} http_status=422 "
            f"error=invalid_vrn_format "
            f"timestamp={datetime.now(timezone.utc).isoformat()}"
        )
        raise HTTPException(
            status_code=422,
            detail="That doesn't look like a UK registration. Check it and try again.",
        )

    try:
        mot_history = await dvsa_client.get_mot_history(vrn_clean)
    except httpx.HTTPStatusError as exc:
        # DVSA returns 404 (MOTH-NF-01) when it holds no record, e.g. a mistyped, scrapped or exported reg
        if exc.response.status_code != 404:
            raise _lookup_failed(vrn_ref, ip_ref, t0) from exc
        print(
            f"VRM_LOOKUP vrn_ref={vrn_ref} ip_ref={ip_ref} http_status=404 "
            f"error=vehicle_not_found "
            f"timestamp={datetime.now(timezone.utc).isoformat()}"
        )
        raise HTTPException(
            status_code=404,
            detail=(
                "We couldn't find this vehicle. Check the registration is typed correctly. "
                "If it is, the car may have been scrapped, exported or re-registered. "
                "We can only check cars currently on UK roads."
            ),
        ) from exc
    except Exception as exc:
        raise _lookup_failed(vrn_ref, ip_ref, t0) from exc

    dvla_ok = True
    vehicle_details = {}
    if config.DVLA_API_KEY:
        try:
            vehicle_details = await dvla_client.get_vehicle_details(vrn_clean)
        except Exception:
            dvla_ok = False

    duration_ms = round((time.monotonic() - t0) * 1000)
    print(
        f"VRM_LOOKUP vrn_ref={vrn_ref} ip_ref={ip_ref} http_status=200 "
        f"dvla={'ok' if dvla_ok else 'fail'} duration_ms={duration_ms} "
        f"timestamp={datetime.now(timezone.utc).isoformat()}"
    )

    return {
        "vrn": vrn_clean,
        "mot_history": mot_history,
        "vehicle_details": vehicle_details,
    }
