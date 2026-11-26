import unittest

from support_inquiries import count_threads


def page(messages):
    return {"messages": [{"subject": subject, "threadId": thread} for subject, thread in messages],
            "has_more": False, "nextPageToken": "", "count": len(messages)}


class SupportTests(unittest.TestCase):
    def test_only_anchored_app_subjects_count_one_time_per_thread(self):
        inputs = [("[모두의정책] 문의", "1"), ("[모두의정책] 문의", "1"), ("[VIRTUE] 문의", "2"),
                  ("Re: [virtue] 문의", "3"), ("[AI 브리핑] [virtue]", "4"), ("다른 [모두의정책]", "5"),
                  ("[virtue-plus] 질문", "6"), (" [virtue] 질문", "7")]
        self.assertEqual(count_threads(page(inputs)), {"policycock": 1, "Virtue": 1})
        self.assertEqual(count_threads(page([])), {"policycock": 0, "Virtue": 0})

    def test_partial_results_do_not_become_zero(self):
        for change in ({"has_more": True}, {"nextPageToken": "more"}, {"count": 3}, {"messages": None}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                count_threads(dict(page([]), **change))
