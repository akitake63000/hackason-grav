from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Validate environment variables before proceeding
from .env_validator import validate_env_vars_on_startup
validate_env_vars_on_startup()

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .routers import food_sniper, health, lifestyle, mental_shield, photos, reports
from .config import ALLOWED_ORIGINS
from .middleware import ResponseTimeMiddleware, RateLimitMiddleware, limiter
from .monitoring import init_sentry
from .error_handler import (
    global_exception_handler,
    create_error_response,
    ErrorCode,
    handle_validation_error
)

# Initialize error monitoring (Sentry)
init_sentry()

app = FastAPI(title="HairGuard Agent API")

# Add rate limiter to app state
app.state.limiter = limiter

# Custom exception handlers for consistent error responses
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTPException with structured error response."""
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Map HTTP status codes to error codes
    status_to_error_code = {
        400: ErrorCode.INVALID_INPUT,
        401: "AUTH_TOKEN_INVALID",  # Will be mapped to ErrorCode
        403: ErrorCode.PERMISSION_DENIED,
        404: ErrorCode.RESOURCE_NOT_FOUND,
        422: ErrorCode.VALIDATION_FAILED,
        429: ErrorCode.RATE_LIMIT_EXCEEDED,
        500: ErrorCode.INTERNAL_ERROR,
        503: ErrorCode.SERVICE_UNAVAILABLE,
    }

    error_code_str = status_to_error_code.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
    # Convert string to ErrorCode if needed
    if isinstance(error_code_str, str):
        error_code = ErrorCode(error_code_str) if error_code_str in [e.value for e in ErrorCode] else ErrorCode.INTERNAL_ERROR
    else:
        error_code = error_code_str

    return create_error_response(
        error_code=error_code,
        message=str(exc.detail),
        status_code=exc.status_code,
        request_id=request_id
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors with structured error response."""
    request_id = request.headers.get("X-Request-ID", "unknown")
    return handle_validation_error(exc, request_id)

async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit errors with structured error response and Retry-After header."""
    request_id = request.headers.get("X-Request-ID", "unknown")

    # Try to extract reset time from limiter storage
    # slowapi stores reset time in request.state if available
    retry_after = 60  # Default fallback

    # Check if reset time is available in request state
    if hasattr(request.state, "_rate_limit_reset_time"):
        import time
        reset_time = getattr(request.state, "_rate_limit_reset_time", None)
        if reset_time:
            retry_after = max(1, int(reset_time - time.time()))

    response = create_error_response(
        error_code=ErrorCode.RATE_LIMIT_EXCEEDED,
        message="Rate limit exceeded. Please try again later.",
        status_code=429,
        details={"retry_after": retry_after},
        request_id=request_id
    )

    # Add Retry-After header per RFC 6585
    response.headers["Retry-After"] = str(retry_after)

    return response

# Register exception handlers
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)

# Add global exception handler for consistent error responses (catch-all)
app.add_exception_handler(Exception, global_exception_handler)

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
