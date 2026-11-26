import json
import unittest
from unittest.mock import patch

from support_inquiries import current_scopes, match_page, POSTHOG, GA4, searches, tag_map


def page(messages):
    return {"messages": [{"subject": subject, "threadId": thread} for subject, thread in messages],
            "has_more": False, "nextPageToken": "", "count": len(messages)}


class SupportTests(unittest.TestCase):
    def test_only_anchored_registered_app_subjects_count_once_across_queries(self):
        scopes = ["policycock", "Virtue", "blog", "afzma", "miniapp-image-tools"]
        tags, threads = tag_map(scopes), {scope: set() for scope in scopes}
        inputs = [("[모두의정책] 문의", "1"), ("[policycock] 문의", "1"), ("[VIRTUE] 문의", "2"),
                  ("Re: [virtue] 문의", "3"), ("[AI 브리핑] [virtue]", "4"), ("다른 [모두의정책]", "5"),
                  ("[virtue-plus] 질문", "6"), (" [virtue] 질문", "7"), ("[blog] [AI 브리핑]", "8"),
                  ("[blog] [파트너] 문의", "9"), ("[MINIAPP-IMAGE-TOOLS]제안", "10")]
        for _ in range(2):
            match_page(page(inputs), tags, threads)
        self.assertEqual([len(threads[s]) for s in scopes], [1, 1, 1, 0, 1])

    def test_dynamic_aliases_use_only_unambiguous_short_names(self):
        scopes = ["app:hello", "project-9 / app:hello", "host:chat.example.com", "project-9 / app:world"]
        tags = tag_map(scopes)
        self.assertNotIn("hello", tags)
        self.assertEqual(tags["app:hello"], "app:hello")
        self.assertEqual(tags["world"], "project-9 / app:world")
        self.assertEqual(tags["chat.example.com"], "host:chat.example.com")
        self.assertEqual(tags["chat"], "host:chat.example.com")

    def test_partial_results_do_not_become_zero(self):
        for change in ({"has_more": True}, {"nextPageToken": "more"}, {"count": 3}, {"messages": None}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                match_page(dict(page([]), **change), {}, {})

    def test_inventory_includes_both_sources_and_drops_unidentified(self):
        rows = [{"metric": {"__name__": name, "scope": scope}} for name, scope in
                [(GA4, "blog"), (POSTHOG, "앱 미지정"), (POSTHOG, "project-7 / 앱 미지정"), (POSTHOG, "Virtue")]]
        with patch("support_inquiries.subprocess.run") as run:
            body = {"status": "success", "data": {"resultType": "vector", "result": rows}}
            run.return_value.stdout = json.dumps(body)
            self.assertEqual(current_scopes(["kubectl"]), ["Virtue", "blog"])
            rows.pop(0)
            run.return_value.stdout = json.dumps(body)
            with self.assertRaises(ValueError):
                current_scopes(["kubectl"])

    def test_large_inventory_batches_gmail_search(self):
        queries = list(searches("a@example.com", 2000000, [f"app-{i:04}" for i in range(250)]))
        self.assertGreater(len(queries), 1)
        self.assertEqual(sum(q.count('subject:"app-') for q in queries), 250)
