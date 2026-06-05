from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import vehicle
from app import config

app = FastAPI(title="Kerbside API", version="0.1.0")

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
