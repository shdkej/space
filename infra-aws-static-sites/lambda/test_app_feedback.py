"""Local integration contracts for the disabled policycock launch signup."""
import hashlib
import importlib.util
import json
import os
import re
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from unittest.mock import patch

import boto3
from moto import mock_aws


class FakeSES:
    def __init__(self):
        self.sent = []
        self.fail = False
        self.lock = threading.Lock()

    def send_email(self, **kwargs):
        if self.fail:
            raise RuntimeError("SES unavailable")
        with self.lock:
            self.sent.append(kwargs)
        return {"MessageId": "test-id"}


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.aws = mock_aws()
        self.aws.start()
        self.addCleanup(self.aws.stop)
        self.ses = FakeSES()
        self.env = patch.dict(os.environ, {
            "AWS_DEFAULT_REGION": "us-east-1", "AWS_CONFIG_FILE": os.devnull,
            "AWS_SHARED_CREDENTIALS_FILE": os.devnull, "AWS_ACCESS_KEY_ID": "testing",
            "AWS_SECRET_ACCESS_KEY": "testing", "AWS_EC2_METADATA_DISABLED": "true",
            "FEEDBACK_BUCKET": "example-feedback",
            "FEEDBACK_RECIPIENT_EMAIL": "owner@example.org",
            "FEEDBACK_SENDER_EMAIL": "sender@example.org",
            "ALLOWED_ORIGINS": "https://policycock.aws.shdkej.com",
            "POLICYCOCK_SIGNUP_TABLE": "policycock-signup-test",
            "ENABLE_POLICYCOCK_SIGNUP": "true",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.ddb = boto3.resource("dynamodb", region_name="us-east-1")
        self.table = self.ddb.create_table(
            TableName="policycock-signup-test",
            KeySchema=[{"AttributeName": "email_hash", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "email_hash", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        self.s3 = boto3.client("s3", region_name="us-east-1")
        self.s3.create_bucket(Bucket="example-feedback")
        real_client = boto3.client
        with patch.object(boto3, "client", side_effect=lambda name, *a, **kw: self.ses if name == "ses" else real_client(name, *a, **kw)):
            spec = importlib.util.spec_from_file_location("feedback_under_test", os.path.join(os.path.dirname(__file__), "app_feedback.py"))
            assert spec and spec.loader
            self.mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(self.mod)

    def invoke(self, **overrides):
        payload = {"appId": "policycock", "type": "launch-notice", "action": "request",
                   "replyEmail": " Reader@Example.org ", "consent": True, "website": "", "variant": "A"}
        payload.update(overrides)
        response = self.mod.handler({"headers": {"origin": "https://policycock.aws.shdkej.com"},
                                     "requestContext": {"http": {"method": "POST"}},
                                     "body": json.dumps(payload)}, None)
        return response["statusCode"], json.loads(response["body"])

    def item(self):
        key = hashlib.sha256(b"reader@example.org").hexdigest()
        return self.table.get_item(Key={"email_hash": key}, ConsistentRead=True).get("Item")

    def token(self):
        text = self.ses.sent[0]["Message"]["Body"]["Text"]["Data"]
        match = re.search(r"#launch-confirm=([a-f0-9]{64}\.[A-Za-z0-9_-]{30,128})", text)
        self.assertIsNotNone(match)
        return match.group(1)

    def test_request_creates_one_pending_item_and_one_verification(self):
        code, body = self.invoke()
        self.assertEqual((code, body["ok"]), (202, True))
        self.assertEqual(self.ses.sent[0]["Destination"]["ToAddresses"], ["reader@example.org"])
        self.assertEqual(self.item()["status"], "pending")
        self.assertEqual(self.item()["email"], "reader@example.org")
        self.assertEqual(self.item()["ttl"], self.item()["created_at"] + 365 * 86400)
        self.assertEqual(len(self.ses.sent), 1)
        self.assertEqual(self.invoke(replyEmail="reader@example.org")[0], 202)
        self.assertEqual(len(self.ses.sent), 1)
        self.assertNotIn("reader@example.org", json.dumps(body))

    def test_confirm_is_single_conditional_transition_and_owner_notice_is_opaque(self):
        self.invoke()
        token = self.token()
        self.assertEqual(self.invoke(action="confirm", token=token)[0], 200)
        self.assertEqual(self.item()["status"], "confirmed")
        self.assertEqual(self.item()["variant"], "A")
        self.assertEqual(len(self.ses.sent), 2)
        notice = self.ses.sent[1]
        self.assertEqual(notice["Destination"]["ToAddresses"], ["owner@example.org"])
        text = notice["Message"]["Body"]["Text"]["Data"]
        self.assertIn("접수 번호:", text)
        self.assertNotIn("reader@example.org", text)
        self.assertNotIn(hashlib.sha256(b"reader@example.org").hexdigest(), text)
        self.assertEqual(self.invoke(action="confirm", token=token)[0], 200)
        self.assertEqual(len(self.ses.sent), 2)

    def test_confirmed_v2_registration_sends_address_only_to_configured_launch_owner(self):
        with patch.dict(os.environ, {"POLICYCOCK_SIGNUP_OWNER_EMAIL": "launch-owner@example.org"}):
            self.assertEqual(self.invoke(consentVersion="launch-notice-v2")[0], 202)
            self.assertEqual(len(self.ses.sent), 1)
            token = self.token()
            self.assertEqual(self.invoke(action="confirm", token=token)[0], 200)
            notice = self.ses.sent[-1]
            self.assertEqual(notice["Destination"]["ToAddresses"], ["launch-owner@example.org"])
            body = notice["Message"]["Body"]["Text"]["Data"]
            self.assertIn("reader@example.org", body)
            self.assertNotIn(token, body)
            self.assertEqual(self.invoke(action="confirm", token=token)[0], 200)
            self.assertEqual(len(self.ses.sent), 2)

    def test_v2_requires_dedicated_owner_before_collecting_email(self):
        with patch.dict(os.environ, {"POLICYCOCK_SIGNUP_OWNER_EMAIL": ""}):
            self.assertEqual(self.invoke(consentVersion="launch-notice-v2")[0], 503)
        self.assertEqual(self.invoke(consentVersion="unknown")[0], 400)
        self.assertIsNone(self.item())
        self.assertFalse(self.ses.sent)

    def test_withdraw_removes_item_atomically_and_old_token_cannot_revive(self):
        self.invoke()
        token = self.token()
        self.assertEqual(self.invoke(action="confirm", token=token)[0], 200)
        self.assertEqual(self.invoke(action="withdraw", token=token)[0], 200)
        self.assertIsNone(self.item())
        self.assertEqual(self.invoke(action="withdraw", token=token)[0], 200)
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)
        self.assertEqual(self.invoke()[0], 202)
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)

    def test_concurrent_confirm_and_withdraw_end_deleted(self):
        self.invoke()
        token = self.token()
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(self.invoke, action="confirm", token=token)
            b = pool.submit(self.invoke, action="withdraw", token=token)
            self.assertIn(a.result()[0], (200, 400, 409, 503))
            self.assertEqual(b.result()[0], 200)
        self.assertIsNone(self.item())
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)

    def test_concurrent_duplicate_requests_have_one_verification(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.invoke(), range(2)))
        self.assertEqual([code for code, _ in results], [202, 202])
        self.assertEqual(len(self.ses.sent), 1)

    def test_expired_token_cannot_confirm_even_if_ttl_has_not_deleted_item(self):
        self.invoke()
        token = self.token()
        self.table.update_item(Key={"email_hash": token.split(".")[0]},
                               UpdateExpression="SET token_expires_at = :old",
                               ExpressionAttributeValues={":old": 1})
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)
        self.assertEqual(self.item()["status"], "pending")
        self.assertEqual(self.invoke()[0], 202)  # replace expired pending atomically
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)

    def test_expired_confirmed_item_is_not_resurrected_or_notified(self):
        self.invoke()
        token = self.token()
        self.table.update_item(Key={"email_hash": token.split(".")[0]},
                               UpdateExpression="SET #ttl = :old",
                               ExpressionAttributeNames={"#ttl": "ttl"},
                               ExpressionAttributeValues={":old": 1})
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)
        self.assertEqual(len(self.ses.sent), 1)
        self.assertEqual(self.invoke()[0], 202)  # replaces overdue item atomically
        self.assertNotEqual(self.invoke(action="confirm", token=token)[0], 200)

    def test_wrong_token_cannot_claim_withdrawal_of_existing_registration(self):
        self.invoke()
        token = self.token()
        wrong = token.split(".")[0] + "." + "x" * 43
        self.assertEqual(self.invoke(action="withdraw", token=wrong)[0], 400)
        self.assertEqual(self.item()["status"], "pending")

    def test_verification_send_failure_does_not_leave_address(self):
        self.ses.fail = True
        self.assertEqual(self.invoke()[0], 503)
        self.assertIsNone(self.item())
        self.ses.fail = False
        self.assertEqual(self.invoke()[0], 202)

    def test_owner_send_failure_never_claims_delivered(self):
        self.invoke()
        token = self.token()
        self.ses.fail = True
        self.assertEqual(self.invoke(action="confirm", token=token)[0], 503)
        self.ses.fail = False
        self.assertEqual(self.invoke(action="confirm", token=token)[0], 503)
        self.assertEqual(len(self.ses.sent), 1)
        self.assertEqual(self.item()["owner_notice"], "claimed")

    def test_invalid_input_honeypot_and_disabled_route(self):
        for data in ({"consent": False}, {"replyEmail": "bad"}, {"appId": "virtue"}):
            self.assertEqual(self.invoke(**data)[0], 400)
        self.assertEqual(self.invoke(action="confirm", token="invalid")[0], 400)
        self.assertEqual(self.invoke(website="bot content")[0], 202)
        self.assertIsNone(self.item())
        self.assertEqual(len(self.ses.sent), 0)
        with patch.dict(os.environ, {"ENABLE_POLICYCOCK_SIGNUP": "false"}):
            self.assertEqual(self.invoke()[0], 503)
        self.assertIsNone(self.item())

    def test_existing_feedback_path_still_stores_and_notifies(self):
        response = self.mod.handler({"headers": {"origin": "https://policycock.aws.shdkej.com"},
                                     "requestContext": {"http": {"method": "POST"}},
                                     "body": json.dumps({"appId": "policycock", "type": "feedback", "message": "Usefully detailed feedback"})}, None)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(len(self.ses.sent), 1)
        self.assertIsNone(self.item())


if __name__ == "__main__":
    unittest.main()
