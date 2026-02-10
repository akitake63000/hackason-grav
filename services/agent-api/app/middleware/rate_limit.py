from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import os
import ipaddress

logger = logging.getLogger(__name__)

# Trusted proxy IP addresses (configure via environment variable)
# Format: comma-separated list of IP addresses or CIDR ranges
# Example: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
TRUSTED_PROXIES_ENV = os.getenv("TRUSTED_PROXIES", "")
TRUSTED_PROXIES = []

if TRUSTED_PROXIES_ENV:
    for proxy_str in TRUSTED_PROXIES_ENV.split(","):
        proxy_str = proxy_str.strip()
        if proxy_str:
            try:
                # Support both single IPs and CIDR ranges
                TRUSTED_PROXIES.append(ipaddress.ip_network(proxy_str, strict=False))
            except ValueError as e:
                logger.warning(f"Invalid trusted proxy IP/CIDR: {proxy_str} - {e}")


def is_trusted_proxy(ip_str: str) -> bool:
    """
    Check if an IP address is from a trusted proxy.

    Args:
        ip_str: IP address string to check

    Returns:
        True if IP is from trusted proxy, False otherwise
    """
    if not TRUSTED_PROXIES:
        # If no trusted proxies configured, don't trust X-Forwarded-For
        return False

    try:
        ip_addr = ipaddress.ip_address(ip_str)
        for trusted_network in TRUSTED_PROXIES:
            if ip_addr in trusted_network:
                return True
    except ValueError:
        # Invalid IP address
        return False

    return False


def get_real_client_ip(request: Request) -> str:
    """
    Get the real client IP address, accounting for proxies/load balancers.

    SECURITY: Only trusts X-Forwarded-For header if the direct connection
    comes from a trusted proxy (configured via TRUSTED_PROXIES env var).

    Args:
        request: FastAPI Request object

    Returns:
        Client IP address as string
    """
    # Get direct connection IP
    direct_ip = get_remote_address(request)

    # Check if request comes from trusted proxy
    if not is_trusted_proxy(direct_ip):
        # Not from trusted proxy, use direct IP
        return direct_ip

    # Request is from trusted proxy, check X-Forwarded-For header
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
        # The first IP is the real client IP
        client_ip = forwarded_for.split(",")[0].strip()

        # Validate that it's a valid IP address
        try:
            ipaddress.ip_address(client_ip)
            return client_ip
        except ValueError:
            # Invalid IP in X-Forwarded-For, fall back to direct IP
            logger.warning(f"Invalid IP in X-Forwarded-For header: {client_ip}")
            return direct_ip

    # No X-Forwarded-For header, use direct IP
    return direct_ip


# Initialize rate limiter with proxy-aware key function
limiter = Limiter(key_func=get_real_client_ip)

# Rate limit configurations by endpoint pattern
# NOTE: Currently, rate limiting is enforced via @limiter.limit() decorators on individual routes.
# This middleware (RateLimitMiddleware) is commented out in main.py.
# These values should match decorator limits for consistency when middleware is enabled.
# Format: {path_pattern: limit_string}
RATE_LIMITS = {
    # Health checks - very permissive (matches decorator: 300/minute)
    "/api/health": "300/minute",
    "/api/v1/health": "300/minute",
    "/api/v1/health/ready": "300/minute",
    "/api/v1/health/live": "300/minute",

    # GET endpoints - more permissive for dashboard
    # NOTE: photos/reports routes currently do NOT have @limiter.limit decorators.
    # These values are for future middleware use.
    "/api/v1/photos/analysis-history": "100/minute",

    # POST endpoints - more restrictive
    "/api/v1/photos/analyze": "5/minute",  # no decorator yet
    "/api/v1/mental-shield/chat": "10/minute",  # matches decorator
    "/api/v1/mental-shield/chat/discuss": "10/minute",  # matches decorator
    "/api/v1/food-sniper/recommend": "10/minute",  # matches decorator
    "/api/v1/food-sniper/recipe": "10/minute",  # matches decorator
    "/api/v1/reports/generate": "3/minute",  # no decorator yet

    # Lifestyle endpoints (matches decorators)
    "/api/v1/lifestyle/health": "300/minute",
    "/api/v1/lifestyle/tip": "20/minute",
    "/api/v1/lifestyle/meal-analyze": "10/minute",
    "/api/v1/lifestyle/tendency": "30/minute",
    "/api/v1/lifestyle/tendency/latest": "60/minute",
    "/api/v1/lifestyle/recommendation": "30/minute",
    "/api/v1/lifestyle/plan/generate": "10/minute",
    "/api/v1/lifestyle/plan/daily/generate": "10/minute",
    "/api/v1/lifestyle/plan/current": "60/minute",
    "/api/v1/lifestyle/plan/check": "100/minute",
}

# Default rate limit for unspecified endpoints
DEFAULT_RATE_LIMIT = "30/minute"


def get_rate_limit_for_path(path: str) -> str:
    """
    Get the rate limit string for a given path.
    Returns specific limit if matched, otherwise returns default.
    """
    # Exact match
    if path in RATE_LIMITS:
        return RATE_LIMITS[path]

    # Pattern match (for dynamic routes)
    for pattern, limit in RATE_LIMITS.items():
        if path.startswith(pattern):
            return limit

    return DEFAULT_RATE_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to apply rate limiting to API endpoints.
    Uses different limits based on endpoint type.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limiting for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Get rate limit for this path
        rate_limit = get_rate_limit_for_path(request.url.path)

        try:
            # Apply rate limit (this is a simplified approach)
            # In production, you'd integrate slowapi more deeply
            response = await call_next(request)

            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = rate_limit

            return response

        except RateLimitExceeded as e:
            logger.warning(f"Rate limit exceeded for {request.client.host} on {request.url.path}")
            # Return 429 Too Many Requests
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Please try again later.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        except Exception as e:
            logger.error(f"Error in rate limit middleware: {e}", exc_info=True)
            # Don't block requests if rate limiting fails
            return await call_next(request)
