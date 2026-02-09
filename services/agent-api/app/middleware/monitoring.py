import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class ResponseTimeMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor API response times.
    Logs request method, path, status code, and processing time.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()

        # Process the request
        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time
        process_time_ms = round(process_time * 1000, 2)

        # Add header for client visibility
        response.headers["X-Process-Time"] = str(process_time_ms)

        # Log the request details
        log_data = {
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "process_time_ms": process_time_ms,
        }

        # Use different log levels based on response time
        if process_time_ms > 5000:  # > 5 seconds
            logger.warning(f"Slow request detected: {log_data}")
        elif process_time_ms > 2000:  # > 2 seconds
            logger.info(f"Request processed: {log_data}")
        else:
            logger.debug(f"Request processed: {log_data}")

        return response
