#!/bin/bash
export FIREBASE_STORAGE_BUCKET=hackason-grab.firebasestorage.app
export GOOGLE_CLOUD_PROJECT=hackason-grab
export GOOGLE_CLOUD_LOCATION=us-central1

# Use Vertex AI instead of Google AI Studio
export GOOGLE_GENAI_USE_VERTEXAI=true

# Gemini Models Configuration
export GEMINI_MODEL=gemini-1.5-flash
export GEMINI_MODEL_LIGHT=gemini-1.5-flash
export GEMINI_MODEL_HEAVY=gemini-1.5-pro
export GEMINI_MODEL_VISION=gemini-1.5-pro

source venv/bin/activate
uvicorn app.main:app --reload --port 8000
