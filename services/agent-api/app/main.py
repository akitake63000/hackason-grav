from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import food_sniper, health, lifestyle, mental_shield, photos, reports
from .config import ALLOWED_ORIGINS

app = FastAPI(title="HairGuard Agent API")

allowed_origins = [
    origin.strip()
    for origin in ALLOWED_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(photos.router)
app.include_router(reports.router)
app.include_router(mental_shield.router)
app.include_router(food_sniper.router)
app.include_router(lifestyle.router)
