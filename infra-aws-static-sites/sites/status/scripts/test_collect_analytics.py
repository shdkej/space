from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("collector", Path(__file__).with_name("collect-analytics.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
now = datetime(2026, 11, 24, 18, tzinfo=timezone.utc)


class CollectorTests(unittest.TestCase):
    def test_ga4_report_dates_no_rows_and_zero(self):
        report = {"metadata": {"timeZone": "Asia/Seoul"}, "metricHeaders": [{"name": "newUsers"}, {"name": "sessions"}]}
        with patch.object(collector, "request", return_value=report) as request:
            no_rows = collector.ga4(now, "blog", "123", "test")
            self.assertEqual(no_rows["values"], {"newUsers": None, "sessions": None})
            self.assertEqual(no_rows["periodEnd"], "2026-11-24")
            self.assertEqual(request.call_args.args[-1]["dateRanges"][0]["endDate"], "yesterday")
            report["rows"] = [{"metricValues": [{"value": "0"}, {"value": "5"}]}]
            self.assertEqual(collector.ga4(now, "blog", "123", "test")["values"], {"newUsers": 0, "sessions": 5})

    def test_posthog_groups_null_and_excludes_synthetic(self):
        config = {"project": "424014", "app_id": None}
        with patch.object(collector, "request", return_value={"results": [[0, 1, 3]]}) as request:
            row = collector.posthog(now, "앱 미지정", config, "test")
            query = request.call_args.args[-1]["query"]["query"]
            self.assertIn("properties.app_id IS NULL", query)
            self.assertIn("!= 'synthetic'", query)
            self.assertEqual(row["values"], {"sessions": 0, "pageviews": 1, "events": 3})
            config["app_id"] = "invalid quote'"
            with self.assertRaises(ValueError):
                collector.posthog(now, "bad", config, "test")
            self.assertEqual(request.call_count, 1)

    def test_virtue_domains_share_a_scope_and_are_excluded_from_unassigned(self):
        inventory = json.loads(Path(__file__).with_name("analytics-inventory.json").read_text())
        apps = collector.inventory_for("posthog", inventory)
        hosts = [host for config in apps.values() for host in collector.reporting_hosts(config)]
        _, virtue = collector.posthog_query(apps["Virtue"], hosts)
        _, other = collector.posthog_query(apps["앱 미지정"], hosts)
        for host in ("virtue.aws.shdkej.com", "virtue.oracle.shdkej.com"):
            self.assertIn(f"'{host}'", virtue)
            self.assertIn(f"'{host}'", other)
        self.assertIn("properties.$host IN (", virtue)
        self.assertIn("NOT IN (", other)

    def test_wrong_instagram_account_stops_before_insights(self):
        with patch.dict(collector.os.environ, {"INSTAGRAM_ACCESS_TOKEN": "test"}), patch.object(
            collector, "request", return_value={"username": "different", "id": "123456"}
        ) as request, self.assertRaises(ValueError):
            collector.instagram(now)
        self.assertEqual(request.call_count, 1)

    def test_failed_source_preserves_prior_file_and_partial_failure_retains_observation(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(collector, "ga4_token", return_value="test"):
            output = Path(tmp)
            inventory = {"ga4": {"blog": "1", "other": "2"}}
            def good(now, scope, prop, token):
                return {"scope": scope, "values": {"sessions": 0}}
            with patch.object(collector, "ga4", side_effect=good):
                dest = collector.collect("ga4", output, inventory)
            old = dest.read_bytes()
            with patch.object(collector, "ga4", side_effect=ValueError()), self.assertRaises(ValueError):
                collector.collect("ga4", output, inventory)
            self.assertEqual(old, dest.read_bytes())
            with patch.object(collector, "ga4", side_effect=[good(None, "blog", None, None), ValueError()]):
                collector.collect("ga4", output, inventory)
            row = json.loads(dest.read_text())["rows"][1]
            self.assertEqual(row["status"], "unavailable")
            self.assertEqual(row["observedAt"], json.loads(old)["rows"][1]["observedAt"])


if __name__ == "__main__":
    unittest.main()
