import unittest
from unittest.mock import MagicMock, patch
import json
import sys
import os

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.gemini_vision import analyze_image_bytes, VisionResult

class TestGeminiGender(unittest.TestCase):
    @patch('app.services.gemini_vision.genai.Client')
    @patch('app.services.gemini_vision.vision_enabled', return_value=True)
    def test_prompt_generation_male(self, mock_vision_enabled, mock_client_cls):
        # Setup mock
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "score": 80.0,
            "notes": "Good",
            "hairType": "Hamilton-Norwood II",
            "pattern": "M字",
            "quality": "good",
            "scalpCondition": "良好"
        })
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        result = analyze_image_bytes(b'fake_image', gender="male")

        # Verify result
        self.assertIsInstance(result, VisionResult)
        self.assertEqual(result.pattern, "M字")
        
        # Verify Prompt
        call_args = mock_client.models.generate_content.call_args
        self.assertIsNotNone(call_args)
        
        # Get contents
        kwargs = call_args.kwargs
        contents = kwargs.get('contents')
        self.assertIsNotNone(contents)
        
        # Extract prompt text
        # contents is list of types.Content
        # content.parts is list of types.Part
        # part.text is the prompt string
        prompt_text = contents[0].parts[0].text
        
        # Assertions for Male Prompt
        self.assertIn("Hamilton-Norwood scale", prompt_text)
        self.assertIn("Hamilton-Norwood III-Vertex", prompt_text) # checking example if present or just string
        self.assertIn("M字", prompt_text)
        self.assertNotIn("Ludwig scale", prompt_text)
        self.assertNotIn("びまん性", prompt_text)

    @patch('app.services.gemini_vision.genai.Client')
    @patch('app.services.gemini_vision.vision_enabled', return_value=True)
    def test_prompt_generation_female(self, mock_vision_enabled, mock_client_cls):
        # Setup mock
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "score": 80.0,
            "notes": "Good",
            "hairType": "Ludwig II",
            "pattern": "びまん性",
            "quality": "good",
            "scalpCondition": "良好"
        })
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        result = analyze_image_bytes(b'fake_image', gender="female")

        # Verify result
        self.assertIsInstance(result, VisionResult)
        self.assertEqual(result.pattern, "びまん性")
        
        # Verify Prompt
        call_args = mock_client.models.generate_content.call_args
        kwargs = call_args.kwargs
        contents = kwargs.get('contents')
        prompt_text = contents[0].parts[0].text
        
        # Assertions for Female Prompt
        self.assertIn("Ludwig scale", prompt_text)
        self.assertIn("びまん性", prompt_text)
        self.assertNotIn("Hamilton-Norwood scale", prompt_text)
        self.assertNotIn("M字", prompt_text)

    @patch('app.services.gemini_vision.genai.Client')
    @patch('app.services.gemini_vision.vision_enabled', return_value=True)
    def test_prompt_generation_prefer_not_to_say(self, mock_vision_enabled, mock_client_cls):
        # Setup mock
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "score": 80.0,
            "notes": "Good",
            "hairType": "Ludwig I",
            "pattern": "びまん性",
            "quality": "good",
            "scalpCondition": "良好"
        })
        mock_client.models.generate_content.return_value = mock_response

        # Execute
        result = analyze_image_bytes(b'fake_image', gender="prefer-not-to-say")

        # Verify result
        self.assertIsInstance(result, VisionResult)
        
        # Verify Prompt
        call_args = mock_client.models.generate_content.call_args
        kwargs = call_args.kwargs
        contents = kwargs.get('contents')
        prompt_text = contents[0].parts[0].text
        
        # Assertions for General Prompt
        self.assertIn("most medically appropriate scale", prompt_text)
        self.assertIn("Hamilton-Norwood or Ludwig", prompt_text)
        self.assertIn("M字", prompt_text)
        self.assertIn("びまん性", prompt_text)

if __name__ == '__main__':
    unittest.main()
