from datetime import datetime, timedelta, timezone
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = spec_from_file_location("refresh", Path(__file__).with_name("refresh-analytics.py"))
refresh = module_from_spec(spec)
spec.loader.exec_module(refresh)


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.start = datetime.now(timezone.utc) - timedelta(seconds=2)
        self.row = {"scope": "a", "status": "ok", "observedAt": datetime.now(timezone.utc).isoformat(),
                    "values": {"newUsers": 0, "sessions": 4}}
        self.feed = {"schemaVersion": 1, "source": "ga4", "observedAt": self.row["observedAt"],
                     "rows": [self.row, {"scope": "b", "status": "unavailable"}]}
        self.old = {"rows": [{"scope": "b", "status": "ok", "observedAt": "2026-01-01T00:00:00Z",
                              "values": {"newUsers": 8, "sessions": 13}}]}
        self.inventory = {"ga4": {"a": "1", "b": "2"}}

    def merged(self):
        return refresh.merge("ga4", self.feed, self.old, self.inventory, self.start)

    def test_partial_failure_preserves_observation(self):
        result, complete = self.merged()
        self.assertFalse(complete)
        self.assertEqual(result["rows"][1], {**self.old["rows"][0], "status": "unavailable"})
        self.assertEqual(result["rows"][0]["values"]["newUsers"], 0)

    def test_total_failure_does_not_publish(self):
        self.row["status"] = "unavailable"
        with self.assertRaises(ValueError):
            self.merged()

    def test_rejects_duplicate_scopes_invalid_metrics_and_stale_timestamp(self):
        for invalid in ({"scope": "b"}, {"values": {"newUsers": -1, "sessions": 0}},
                        {"observedAt": "2020-01-01T00:00:00Z"}, {"email": "unexpected"}):
            with self.subTest(invalid=invalid), patch.dict(self.row, invalid), self.assertRaises(ValueError):
                self.merged()

    def test_default_credential_fields_only_in_legacy_file(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp, "credentials")
            path.write_text("[default]\naws_access_key_id=a\naws_secret_access_key=b\nignored line\n"
                            "[other]\naws_access_key_id=c\naws_secret_access_key=d\n")
            self.assertEqual(refresh.aws_credentials(path), {"aws_access_key_id": "a", "aws_secret_access_key": "b"})


if __name__ == "__main__":
    unittest.main()
