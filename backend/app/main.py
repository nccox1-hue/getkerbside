import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter
from app.routes import vehicle
from app import config

# Uvicorn's default access log writes the full URL path, which includes the raw
# VRM (e.g. GET /api/v1/vehicle/AB12CDE). VRMs are personal data under UK GDPR.
# Custom VRM_LOOKUP log lines in vehicle.py capture everything needed for
# troubleshooting and analysis using hashed references instead.
logging.getLogger("uvicorn.access").disabled = True

app = FastAPI(title="Kerbside API", version="0.1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(vehicle.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


_frontend = Path(__file__).parent.parent.parent / "frontend"
if _frontend.exists():
    app.mount("/", StaticFiles(directory=_frontend, html=True), name="frontend")
