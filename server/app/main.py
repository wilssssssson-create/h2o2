from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import engine
from app.models import Base
from app.routers import auth, calibrations, detections


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.database_url.startswith("sqlite"):
        settings_path = settings.database_url.removeprefix("sqlite:///")
        from pathlib import Path

        Path(settings_path).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="TMB-H₂O₂", lifespan=lifespan)
cors_kwargs: dict = {"allow_origins": settings.origin_list, "allow_credentials": True, "allow_methods": ["*"], "allow_headers": ["*"]}
if settings.allow_lan_origins:
    cors_kwargs["allow_origin_regex"] = r"https?://(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d+)?$"
app.add_middleware(CORSMiddleware, **cors_kwargs)
app.include_router(auth.router)
app.include_router(calibrations.router)
app.include_router(detections.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}
