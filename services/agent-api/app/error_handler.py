"""
Centralized error handling utilities.
Provides consistent error responses and logging across all API endpoints.
"""

import logging
from typing import Optional, Dict, Any
from enum import Enum

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from google.cloud.exceptions import GoogleCloudError
from firebase_admin.exceptions import FirebaseError
from pydantic import ValidationError

from .monitoring.sentry import capture_exception, set_request_context

logger = logging.getLogger(__name__)


class ErrorCode(str, Enum):
    """Standardized error codes for API responses."""

    # Authentication errors (401)
    AUTH_TOKEN_MISSING = "AUTH_TOKEN_MISSING"
    AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"

    # Authorization errors (403)
    PERMISSION_DENIED = "PERMISSION_DENIED"
    RESOURCE_ACCESS_DENIED = "RESOURCE_ACCESS_DENIED"

    # Not found errors (404)
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    PHOTO_NOT_FOUND = "PHOTO_NOT_FOUND"

    # Validation errors (422)
    INVALID_INPUT = "INVALID_INPUT"
    VALIDATION_FAILED = "VALIDATION_FAILED"

    # Rate limiting (429)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

    # Server errors (500)
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR"

    # Service unavailable (503)
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    EXTERNAL_SERVICE_TIMEOUT = "EXTERNAL_SERVICE_TIMEOUT"


class APIError(Exception):
    """Base exception for API errors with structured error information."""

    def __init__(
        self,
        message: str,
        error_code: ErrorCode,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


def create_error_response(
    error_code: ErrorCode,
    message: str,
    status_code: int,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None
) -> JSONResponse:
    """
    Create standardized error response.

    Args:
        error_code: Standardized error code
        message: Human-readable error message
        status_code: HTTP status code
        details: Optional additional error details
        request_id: Optional request ID for tracing

    Returns:
        JSONResponse with structured error information
    """
    error_response = {
        "error": {
            "code": error_code.value,
            "message": message,
            "status": status_code,
        }
    }

    if details:
        error_response["error"]["details"] = details

    if request_id:
        error_response["error"]["request_id"] = request_id

    return JSONResponse(
        status_code=status_code,
        content=error_response
    )


def handle_firebase_error(error: FirebaseError, request_id: Optional[str] = None) -> JSONResponse:
    """
    Handle Firebase errors with appropriate HTTP status codes.

    Args:
        error: FirebaseError exception
        request_id: Optional request ID for tracing

    Returns:
        JSONResponse with structured error information
    """
    error_message = str(error)

    # Map Firebase errors to appropriate HTTP status codes
    if "NOT_FOUND" in error_message or "not found" in error_message.lower():
        return create_error_response(
            ErrorCode.RESOURCE_NOT_FOUND,
            "The requested resource was not found in Firebase",
            status.HTTP_404_NOT_FOUND,
            {"firebase_error": error_message},
            request_id
        )
    elif "PERMISSION_DENIED" in error_message or "permission denied" in error_message.lower():
        return create_error_response(
            ErrorCode.PERMISSION_DENIED,
            "Permission denied to access Firebase resource",
            status.HTTP_403_FORBIDDEN,
            {"firebase_error": error_message},
            request_id
        )
    else:
        return create_error_response(
            ErrorCode.DATABASE_ERROR,
            "Firebase operation failed",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            {"firebase_error": error_message},
            request_id
        )


def handle_google_cloud_error(error: GoogleCloudError, request_id: Optional[str] = None) -> JSONResponse:
    """
    Handle Google Cloud errors with appropriate HTTP status codes.

    Args:
        error: GoogleCloudError exception
        request_id: Optional request ID for tracing

    Returns:
        JSONResponse with structured error information
    """
    error_message = str(error)

    # Map GCP errors to appropriate HTTP status codes
    if hasattr(error, 'code'):
        if error.code == 404:
            return create_error_response(
                ErrorCode.RESOURCE_NOT_FOUND,
                "The requested resource was not found in Google Cloud",
                status.HTTP_404_NOT_FOUND,
                {"gcp_error": error_message},
                request_id
            )
        elif error.code == 403:
            return create_error_response(
                ErrorCode.PERMISSION_DENIED,
                "Permission denied to access Google Cloud resource",
                status.HTTP_403_FORBIDDEN,
                {"gcp_error": error_message},
                request_id
            )
        elif error.code == 429:
            return create_error_response(
                ErrorCode.RATE_LIMIT_EXCEEDED,
                "Google Cloud API rate limit exceeded",
                status.HTTP_429_TOO_MANY_REQUESTS,
                {"gcp_error": error_message},
                request_id
            )

    return create_error_response(
        ErrorCode.EXTERNAL_API_ERROR,
        "Google Cloud operation failed",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        {"gcp_error": error_message},
        request_id
    )


def handle_validation_error(error: ValidationError, request_id: Optional[str] = None) -> JSONResponse:
    """
    Handle Pydantic validation errors with detailed field information.

    Args:
        error: ValidationError exception
        request_id: Optional request ID for tracing

    Returns:
        JSONResponse with structured validation error information
    """
    validation_errors = []
    for err in error.errors():
        validation_errors.append({
            "field": ".".join(str(loc) for loc in err["loc"]),
            "message": err["msg"],
            "type": err["type"]
        })

    return create_error_response(
        ErrorCode.VALIDATION_FAILED,
        "Request validation failed",
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        {"validation_errors": validation_errors},
        request_id
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global exception handler for all unhandled exceptions.
    Automatically reports errors to Sentry with context.

    Args:
        request: FastAPI Request object
        exc: Unhandled exception

    Returns:
        JSONResponse with error information
    """
    request_id = request.headers.get("X-Request-ID", "unknown")
    endpoint = request.url.path
    method = request.method

    # Set request context for Sentry
    set_request_context(
        request_id=request_id,
        endpoint=endpoint,
        method=method
    )

    # Log the exception with full context
    logger.error(
        f"Unhandled exception in {method} {endpoint}",
        exc_info=exc,
        extra={
            "request_id": request_id,
            "method": method,
            "path": endpoint,
            "query_params": dict(request.query_params),
        }
    )

    # Determine error code for Sentry tagging
    error_code = ErrorCode.INTERNAL_ERROR

    # Handle specific exception types
    if isinstance(exc, FirebaseError):
        error_code = ErrorCode.DATABASE_ERROR
        response = handle_firebase_error(exc, request_id)
    elif isinstance(exc, GoogleCloudError):
        error_code = ErrorCode.EXTERNAL_API_ERROR
        response = handle_google_cloud_error(exc, request_id)
    elif isinstance(exc, ValidationError):
        error_code = ErrorCode.VALIDATION_FAILED
        response = handle_validation_error(exc, request_id)
    elif isinstance(exc, HTTPException):
        error_code = ErrorCode.INTERNAL_ERROR
        response = create_error_response(
            error_code,
            exc.detail,
            exc.status_code,
            None,
            request_id
        )
    elif isinstance(exc, APIError):
        error_code = exc.error_code
        response = create_error_response(
            exc.error_code,
            exc.message,
            exc.status_code,
            exc.details,
            request_id
        )
    else:
        # Default error response for unknown exceptions
        response = create_error_response(
            ErrorCode.INTERNAL_ERROR,
            "An unexpected error occurred. Please try again later.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            {"exception_type": type(exc).__name__},
            request_id
        )

    # Extract actual status_code from response to determine Sentry reporting
    actual_status_code = response.status_code

    # Report to Sentry for server errors (5xx) only
    if actual_status_code >= 500:
        capture_exception(
            exc,
            context={
                "request_id": request_id,
                "endpoint": endpoint,
                "method": method,
                "query_params": dict(request.query_params),
            },
            error_code=error_code.value if isinstance(error_code, ErrorCode) else str(error_code),
            endpoint=endpoint
        )

    return response
