from unittest import TestCase
from unittest.mock import patch

import work_counts


class WorkCountTests(TestCase):
    @patch.object(work_counts, "credential", return_value="test")
    @patch.object(work_counts, "request")
    def test_notion_counts_every_page_and_only_empty_selects(self, request, _credential):
        def row(selection):
            return {"properties": {"플랫폼": {"type": "select", "select": selection}}}

        request.side_effect = [
            {"properties": {"플랫폼": {"type": "select", "id": "zf%60R"}}},
            {"results": [row(None)], "has_more": True, "next_cursor": "next"},
            {"results": [row({"name": "Instagram"})], "has_more": False, "next_cursor": None},
        ]
        self.assertEqual(work_counts.notion_counts(), {"total": 2, "withoutPlatform": 1})
        self.assertIn("filter_properties=zf%60R", request.call_args.args[0])
        self.assertEqual(request.call_args.args[2]["start_cursor"], "next")

    @patch.object(work_counts, "credential", return_value="test")
    @patch.object(work_counts, "request")
    def test_linear_partial_graphql_error_cannot_be_counted_as_zero(self, request, _credential):
        request.return_value = {"errors": [{"message": "Unavailable"}], "data": {"issues": None}}
        with self.assertRaises(ValueError):
            work_counts.linear_counts()
