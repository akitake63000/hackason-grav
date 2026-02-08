import unittest
from unittest.mock import MagicMock, patch
import sys
import os
from datetime import datetime, timezone, timedelta

# Add app to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.routers.reports import generate_report, ReportGenerateRequest, ReportGenerateResponse
from app.firestore_mock import MockFirestoreClient, MockDocumentSnapshot

class TestReportGeneration(unittest.TestCase):
    def setUp(self):
        self.mock_db = MockFirestoreClient()
        self.uid = "test_user_id"
        self.mock_gemini_response = {
            "highlights": ["Highlight 1", "Highlight 2"],
            "nextActions": ["Action 1", "Action 2"],
            "rawText": "Generated Report Text"
        }

    @patch("app.routers.reports.get_firestore_client")
    @patch("app.routers.reports.generate_text")
    @patch("app.routers.reports.gemini_enabled")
    def test_generate_report_success_gemini(self, mock_gemini_enabled, mock_generate_text, mock_get_db):
        # Setup Mocks
        mock_get_db.return_value = self.mock_db
        mock_gemini_enabled.return_value = True
        import json
        mock_generate_text.return_value = json.dumps(self.mock_gemini_response)

        # Setup Mock Data in Firestore
        # Add analysis results
        analysis_ref = self.mock_db.collection("analysisResults").document(self.uid).collection("items")
        
        now = datetime.now(timezone.utc)
        # Add 3 mock entries
        for i in range(3):
            doc_data = {
                "computedAt": now - timedelta(days=i),
                "densityIndex": 3.5 + (i * 0.1)
            }
            analysis_ref.document(f"doc_{i}").set(doc_data)

        # Execute
        payload = ReportGenerateRequest(periodDays=7)
        response = generate_report(payload, uid=self.uid)

        # Assert Response
        self.assertIsInstance(response, ReportGenerateResponse)
        self.assertEqual(len(response.highlights), 2)
        self.assertEqual(response.highlights[0], "Highlight 1")
        self.assertTrue(response.reportId.startswith("report_"))

        # Assert Firestore Save
        reports_ref = self.mock_db.collection("reports").document(self.uid).collection("items")
        saved_reports = reports_ref.get()
        self.assertEqual(len(saved_reports), 1)
        saved_data = saved_reports[0].to_dict()
        self.assertEqual(saved_data["highlights"], self.mock_gemini_response["highlights"])

    @patch("app.routers.reports.get_firestore_client")
    @patch("app.routers.reports.gemini_enabled")
    def test_generate_report_fallback_rule_based(self, mock_gemini_enabled, mock_get_db):
        # Setup Mocks to disable Gemini or fail it
        mock_get_db.return_value = self.mock_db
        mock_gemini_enabled.return_value = False # Force rule-based

        # Setup Mock Data
        analysis_ref = self.mock_db.collection("analysisResults").document(self.uid).collection("items")
        now = datetime.now(timezone.utc)
        
        # Add data to trigger rule-based logic
        # 1st data point (oldest)
        analysis_ref.document("doc_old").set({
            "computedAt": now - timedelta(days=5),
            "densityIndex": 3.0
        })
        # 2nd data point (newest)
        analysis_ref.document("doc_new").set({
            "computedAt": now - timedelta(days=1),
            "densityIndex": 3.1 # increased by 0.1
        })

        # Execute
        payload = ReportGenerateRequest(periodDays=7)
        response = generate_report(payload, uid=self.uid)

        # Assert Response
        self.assertIsInstance(response, ReportGenerateResponse)
        # Rule based returns > 0 highlights
        self.assertTrue(len(response.highlights) > 0)
        # Check specific rule-based string logic if possible, or just presence
        self.assertIn("密度指数は", response.highlights[0])

        # Assert Firestore Save
        reports_ref = self.mock_db.collection("reports").document(self.uid).collection("items")
        saved_docs = reports_ref.get()
        self.assertEqual(len(saved_docs), 1)
        saved_data = saved_docs[0].to_dict()
        self.assertEqual(saved_data["llm"]["model"], "rule_based_v1")

    @patch("app.routers.reports.get_firestore_client")
    @patch("app.routers.reports.gemini_enabled")
    def test_generate_report_no_data(self, mock_gemini_enabled, mock_get_db):
        mock_get_db.return_value = self.mock_db
        mock_gemini_enabled.return_value = False

        # No data added to firestore

        payload = ReportGenerateRequest(periodDays=7)
        response = generate_report(payload, uid=self.uid)

        self.assertIn("期間内の測定データがありません。", response.highlights[0])

if __name__ == '__main__':
    unittest.main()
