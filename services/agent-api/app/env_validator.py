"""
Environment variable validation module.
Validates required environment variables at application startup.
"""

import os
import sys
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class EnvValidationError(Exception):
    """Raised when environment variable validation fails."""
    pass


def _get_bool(key: str, default: str = "false") -> bool:
    """Helper to get boolean environment variable."""
    return os.getenv(key, default).lower() == "true"


def validate_env_var(
    key: str,
    required: bool = False,
    allowed_values: Optional[List[str]] = None,
    default: Optional[str] = None
) -> Optional[str]:
    """
    Validate a single environment variable.

    Args:
        key: Environment variable key
        required: Whether the variable is required
        allowed_values: List of allowed values (if applicable)
        default: Default value if not set

    Returns:
        The environment variable value, or default if not set

    Raises:
        EnvValidationError: If validation fails
    """
    value = os.getenv(key, default)

    if required and not value:
        raise EnvValidationError(f"Required environment variable '{key}' is not set")

    if allowed_values and value and value not in allowed_values:
        raise EnvValidationError(
            f"Environment variable '{key}' has invalid value '{value}'. "
            f"Allowed values: {', '.join(allowed_values)}"
        )

    return value


def validate_all_env_vars() -> Dict[str, str]:
    """
    Validate all required environment variables at startup.

    Returns:
        Dict of validated environment variables

    Raises:
        EnvValidationError: If any validation fails
    """
    validated = {}
    errors = []

    # Environment type validation
    try:
        environment = validate_env_var(
            "ENVIRONMENT",
            required=False,
            allowed_values=["development", "staging", "production"],
            default="development"
        )
        validated["ENVIRONMENT"] = environment
    except EnvValidationError as e:
        errors.append(str(e))
        environment = "development"  # Fallback for later checks

    # Firebase configuration
    try:
        firebase_project_id = validate_env_var(
            "FIREBASE_PROJECT_ID",
            required=True
        )
        validated["FIREBASE_PROJECT_ID"] = firebase_project_id
    except EnvValidationError as e:
        errors.append(str(e))

    try:
        firebase_storage_bucket = validate_env_var(
            "FIREBASE_STORAGE_BUCKET",
            required=True
        )
        validated["FIREBASE_STORAGE_BUCKET"] = firebase_storage_bucket
    except EnvValidationError as e:
        errors.append(str(e))

    # Google Cloud configuration
    use_vertexai = _get_bool("GOOGLE_GENAI_USE_VERTEXAI", "false")
    if use_vertexai:
        try:
            google_cloud_project = validate_env_var(
                "GOOGLE_CLOUD_PROJECT",
                required=True
            )
            validated["GOOGLE_CLOUD_PROJECT"] = google_cloud_project
        except EnvValidationError as e:
            errors.append(str(e))

        try:
            google_cloud_location = validate_env_var(
                "GOOGLE_CLOUD_LOCATION",
                required=False,
                default="global"
            )
            validated["GOOGLE_CLOUD_LOCATION"] = google_cloud_location
        except EnvValidationError as e:
            errors.append(str(e))
    else:
        # If not using Vertex AI, validate GOOGLE_API_KEY instead
        try:
            google_api_key = validate_env_var(
                "GOOGLE_API_KEY",
                required=True
            )
            validated["GOOGLE_API_KEY"] = google_api_key
        except EnvValidationError as e:
            errors.append(str(e))

    # Gemini models
    try:
        gemini_model = validate_env_var(
            "GEMINI_MODEL",
            required=False,
            default="gemini-2.5-flash"
        )
        validated["GEMINI_MODEL"] = gemini_model
    except EnvValidationError as e:
        errors.append(str(e))

    # CORS configuration (required in production)
    if environment == "production":
        try:
            allowed_origins = validate_env_var(
                "ALLOWED_ORIGINS",
                required=True
            )
            validated["ALLOWED_ORIGINS"] = allowed_origins
        except EnvValidationError as e:
            errors.append(str(e))

        # Sentry DSN (recommended in production)
        try:
            sentry_dsn = validate_env_var("SENTRY_DSN")
            if not sentry_dsn:
                logger.warning(
                    "SENTRY_DSN is not set in production environment. "
                    "Error monitoring will not be available."
                )
            else:
                validated["SENTRY_DSN"] = sentry_dsn
        except EnvValidationError as e:
            errors.append(str(e))

    if errors:
        error_message = "Environment variable validation failed:\n" + "\n".join(f"  - {err}" for err in errors)
        logger.error(error_message)
        raise EnvValidationError(error_message)

    logger.info(f"Environment variables validated successfully for environment: {environment}")
    return validated


def validate_env_vars_on_startup() -> None:
    """
    Validate environment variables on application startup.
    Exits the application if validation fails.
    """
    try:
        validate_all_env_vars()
    except EnvValidationError as e:
        logger.critical(f"Startup failed due to environment validation errors:\n{e}")
        sys.exit(1)
