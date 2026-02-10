from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Validate environment variables before proceeding
from .env_validator import validate_env_vars_on_startup
validate_env_vars_on_startup()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .routers import food_sniper, health, lifestyle, mental_shield, photos, reports
from .config import ALLOWED_ORIGINS
from .middleware import ResponseTimeMiddleware, RateLimitMiddleware, limiter
from .monitoring import init_sentry

# Initialize error monitoring (Sentry)
init_sentry()

app = FastAPI(title="HairGuard Agent API")

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins = [
    origin.strip()
    for origin in ALLOWED_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Only allow actually used methods
    allow_headers=["Content-Type", "Authorization", "X-Firebase-Auth"],  # Only allow necessary headers
)

# Add rate limiting (optional - can be enabled via environment variable)
# Note: Rate limiting is configured in middleware/rate_limit.py
# app.add_middleware(RateLimitMiddleware)

# Add response time monitoring
app.add_middleware(ResponseTimeMiddleware)

app.include_router(health.router)
app.include_router(photos.router)
app.include_router(reports.router)
app.include_router(mental_shield.router)
app.include_router(food_sniper.router)
app.include_router(lifestyle.router)
