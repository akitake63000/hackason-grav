import os
import logging
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.logging import LoggingIntegration

logger = logging.getLogger(__name__)


def init_sentry():
    """
    Initialize Sentry for error monitoring and logging.
    Only enabled if SENTRY_DSN environment variable is set.
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
        )

        logger.info(f"Sentry monitoring initialized for environment: {environment}")

    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}", exc_info=True)


def capture_exception(error: Exception, context: dict = None):
    """
    Manually capture an exception and send it to Sentry.

    Args:
        error: The exception to capture
        context: Additional context data to include with the error
    """
    if context:
        sentry_sdk.set_context("custom", context)

    sentry_sdk.capture_exception(error)


def capture_message(message: str, level: str = "info"):
    """
    Capture a message and send it to Sentry.

    Args:
        message: The message to capture
        level: The severity level (debug, info, warning, error, fatal)
    """
    sentry_sdk.capture_message(message, level=level)
