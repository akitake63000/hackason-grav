from typing import Any, Dict

from ....services.gemini_vision import analyze_image_bytes
from ....storage import download_image_bytes

def analyze_hair_image_tool(storage_path: str) -> Dict[str, Any]:
    """
    Tool function to analyze a hair image given its storage path.
    Used by the Agent to get analysis results.
    """
    try:
        # 1. Download
        image_bytes = download_image_bytes(storage_path)
        
        # 2. Analyze
        result = analyze_image_bytes(image_bytes)
        
        return {
            "success": True,
            "score": result.score,
            "notes": result.notes
        }
    except Exception as e:
        # Log the error for debugging (server-side only)
        import logging
        logging.error(f"analyze_hair_image_tool error: {e}", exc_info=True)

        return {
            "success": False,
            "error": "画像分析中にエラーが発生しました"
        }
