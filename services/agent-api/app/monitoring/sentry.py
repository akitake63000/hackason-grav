import os
import logging
import re
from typing import Optional, Dict, Any
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = logging.getLogger(__name__)

# Sensitive field patterns to sanitize
SENSITIVE_PATTERNS = [
    re.compile(r'password', re.IGNORECASE),
    re.compile(r'token', re.IGNORECASE),
    re.compile(r'secret', re.IGNORECASE),
    re.compile(r'api[_-]?key', re.IGNORECASE),
    re.compile(r'authorization', re.IGNORECASE),
    re.compile(r'credential', re.IGNORECASE),
]


def _sanitize_data(data: Any) -> Any:
    """
    Recursively sanitize sensitive data from dictionaries.

    Args:
        data: Data to sanitize (dict, list, or primitive)

    Returns:
        Sanitized data with sensitive fields masked
    """
    if isinstance(data, dict):
        return {
            key: '[REDACTED]' if any(pattern.search(key) for pattern in SENSITIVE_PATTERNS)
            else _sanitize_data(value)
            for key, value in data.items()
        }
    elif isinstance(data, list):
        return [_sanitize_data(item) for item in data]
    else:
        return data


def before_send(event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Process events before sending to Sentry.
    - Sanitize sensitive data
    - Add custom fingerprinting for better error grouping
    - Filter out noise

    Args:
        event: Sentry event dict
        hint: Additional context about the event

    Returns:
        Modified event or None to drop the event
    """
    # Sanitize request data
    if 'request' in event:
        if 'data' in event['request']:
            event['request']['data'] = _sanitize_data(event['request']['data'])
        if 'headers' in event['request']:
            event['request']['headers'] = _sanitize_data(event['request']['headers'])
        if 'cookies' in event['request']:
            event['request']['cookies'] = _sanitize_data(event['request']['cookies'])
        # Sanitize query string
        if 'query_string' in event['request']:
            event['request']['query_string'] = '[REDACTED]'

    # Sanitize extra context
    if 'extra' in event:
        event['extra'] = _sanitize_data(event['extra'])

    # Sanitize contexts (e.g., user context, custom contexts)
    if 'contexts' in event:
        event['contexts'] = _sanitize_data(event['contexts'])

    # Custom fingerprinting based on error code and endpoint
    if 'tags' in event:
        error_code = event['tags'].get('error_code')
        endpoint = event['tags'].get('endpoint')

        if error_code and endpoint:
            # Group errors by error_code + endpoint
            event['fingerprint'] = [error_code, endpoint]
        elif error_code:
            # Group by error_code only
            event['fingerprint'] = [error_code]

    # Filter out health check errors
    if 'request' in event and 'url' in event['request']:
        if '/health' in event['request']['url']:
            return None  # Drop health check errors

    return event


def init_sentry():
    """
    Initialize Sentry for error monitoring and logging with enhanced configuration.
    Only enabled if SENTRY_DSN environment variable is set.

    Features:
    - Automatic error grouping by error code and endpoint
    - Sensitive data sanitization
    - Custom tags and context
    - Performance monitoring
    """
    sentry_dsn = os.getenv("SENTRY_DSN")
    environment = os.getenv("ENVIRONMENT", "development")

    if not sentry_dsn:
        logger.info("Sentry monitoring not configured (SENTRY_DSN not set)")
        return

    try:
        # Configure logging integration
        logging_integration = LoggingIntegration(
            level=logging.INFO,  # Capture info and above as breadcrumbs
            event_level=logging.ERROR  # Send errors as events
        )

        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=environment,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                StarletteIntegration(transaction_style="endpoint"),
                logging_integration,
            ],
            # Set traces_sample_rate to 1.0 to capture 100% of transactions for performance monitoring
            # In production, you may want to reduce this to save quota
            traces_sample_rate=1.0 if environment == "development" else 0.1,

            # Set profiles_sample_rate to profile 100% of sampled transactions
            # In production, you may want to reduce this to save quota
            profiles_sample_rate=1.0 if environment == "development" else 0.1,

            # Send default PII (Personally Identifiable Information)
            send_default_pii=False,  # Set to False for privacy

            # Additional options
            attach_stacktrace=True,
            enable_tracing=True,

            # Custom before_send hook for data sanitization and fingerprinting
            before_send=before_send,

            # Ignore common non-error exceptions
            ignore_errors=[
                KeyboardInterrupt,
                SystemExit,
            ],
        )

        logger.info(f"Sentry monitoring initialized for environment: {environment}")

    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}", exc_info=True)


def capture_exception(
    error: Exception,
    context: Optional[Dict[str, Any]] = None,
    tags: Optional[Dict[str, str]] = None,
    error_code: Optional[str] = None,
    user_id: Optional[str] = None,
    endpoint: Optional[str] = None
):
    """
    Manually capture an exception and send it to Sentry with enhanced context.

    Args:
        error: The exception to capture
        context: Additional context data to include with the error
        tags: Custom tags for categorization
        error_code: Standardized error code (for grouping)
        user_id: User ID (will be hashed for privacy)
        endpoint: API endpoint where error occurred
    """
    # Set custom context
    if context:
        sentry_sdk.set_context("custom", context)

    # Set tags for better categorization
    if tags:
        for key, value in tags.items():
            sentry_sdk.set_tag(key, value)

    # Set standardized tags
    if error_code:
        sentry_sdk.set_tag("error_code", error_code)

    if endpoint:
        sentry_sdk.set_tag("endpoint", endpoint)

    # Set user context (user_id will be hashed by Sentry)
    if user_id:
        sentry_sdk.set_user({"id": user_id})

    # Capture the exception
    sentry_sdk.capture_exception(error)


def capture_message(
    message: str,
    level: str = "info",
    tags: Optional[Dict[str, str]] = None,
    context: Optional[Dict[str, Any]] = None
):
    """
    Capture a message and send it to Sentry with optional context.

    Args:
        message: The message to capture
        level: The severity level (debug, info, warning, error, fatal)
        tags: Custom tags for categorization
        context: Additional context data
    """
    # Set custom context
    if context:
        sentry_sdk.set_context("custom", context)

    # Set tags
    if tags:
        for key, value in tags.items():
            sentry_sdk.set_tag(key, value)

    # Capture the message
    sentry_sdk.capture_message(message, level=level)


def set_request_context(
    request_id: str,
    user_id: Optional[str] = None,
    endpoint: Optional[str] = None,
    method: Optional[str] = None
):
    """
    Set request-specific context for Sentry events.

    Args:
        request_id: Unique request identifier
        user_id: User ID associated with the request
        endpoint: API endpoint path
        method: HTTP method
    """
    sentry_sdk.set_tag("request_id", request_id)

    if user_id:
        sentry_sdk.set_user({"id": user_id})

    if endpoint:
        sentry_sdk.set_tag("endpoint", endpoint)

    if method:
        sentry_sdk.set_tag("http_method", method)
