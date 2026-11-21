import base64
import csv
import hashlib
import io
import json
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import boto3


s3 = boto3.client("s3")
ses = boto3.client("ses")

BUCKET = os.environ["FEEDBACK_BUCKET"]
RECIPIENT_EMAIL = os.environ["FEEDBACK_RECIPIENT_EMAIL"]
SENDER_EMAIL = os.environ["FEEDBACK_SENDER_EMAIL"]
ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
APP_ID_RE = re.compile(r"[^a-z0-9_-]+")


def _origin_for(event):
    headers = event.get("headers") or {}
    return headers.get("origin") or headers.get("Origin") or ""


def _response(status, body, origin=""):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json; charset=utf-8",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def _read_body(event):
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    return json.loads(body)


def _clean_text(value, max_len):
    if value is None:
        return ""
    return str(value).replace("\x00", "").strip()[:max_len]


def _clean_app_id(value):
    raw = _clean_text(value or "unknown", 80).lower()
    cleaned = APP_ID_RE.sub("-", raw).strip("-")
    return cleaned or "unknown"


def _append_csv_line(row):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(row)
    return buf.getvalue()


def _append_monthly_csv(key, row):
    header = [
        "created_at",
        "app_id",
        "app_name",
        "type",
        "path",
        "reply_email",
        "message",
        "app_version",
        "stats_total",
        "stats_count",
        "user_agent",
        "object_key",
    ]
    try:
        current = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read().decode("utf-8-sig")
    except s3.exceptions.NoSuchKey:
        current = _append_csv_line(header)

    s3.put_object(
        Bucket=BUCKET,
        Key=key,
        Body=(current + _append_csv_line(row)).encode("utf-8-sig"),
        ContentType="text/csv; charset=utf-8",
    )


TOKEN_RE = re.compile(r"^([a-f0-9]{64})\.([A-Za-z0-9_-]{30,128})$")


def _signup_table():
    # Only load the table on the explicitly enabled route; existing feedback is unchanged.
    return boto3.resource("dynamodb").Table(os.environ["POLICYCOCK_SIGNUP_TABLE"])


def _conditional_failure(exc):
    return getattr(exc, "response", {}).get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def _signup_item(table, email_hash):
    return table.get_item(Key={"email_hash": email_hash}, ConsistentRead=True).get("Item")


def _notify_owner(table, item, now):
    key = {"email_hash": item["email_hash"]}
    token_hash = item["token_hash"]
    try:
        table.update_item(
            Key=key,
            UpdateExpression="SET owner_notice = :claimed",
            ConditionExpression="#status = :confirmed AND token_hash = :token AND #ttl > :now AND attribute_not_exists(owner_notice)",
            ExpressionAttributeNames={"#status": "status", "#ttl": "ttl"},
            ExpressionAttributeValues={":claimed": "claimed", ":confirmed": "confirmed", ":token": token_hash, ":now": now},
        )
    except Exception as exc:
        if not _conditional_failure(exc):
            raise
        previous = _signup_item(table, item["email_hash"])
        return bool(previous and previous.get("token_hash") == token_hash
                    and previous.get("status") == "confirmed" and previous.get("ttl", 0) > now
                    and previous.get("owner_notice") == "delivered")

    recipient = RECIPIENT_EMAIL
    body = f"접수 번호: {item['receipt_id']}"
    if item.get("consent") == "launch-notice-v2":
        recipient = os.environ.get("POLICYCOCK_SIGNUP_OWNER_EMAIL", "")
        body += (f"\n확인된 이메일: {item['email']}\n"
                 "정책알리미 출시 안내 1회에 동의했습니다. 발송 전 유효한 신청인지 확인해 주세요.")
    try:
        ses.send_email(
            Source=SENDER_EMAIL, Destination={"ToAddresses": [recipient]},
            Message={
                "Subject": {"Data": "[모두의정책] 출시 안내 접수", "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
            },
        )
    except Exception:
        # SES acceptance may be ambiguous. Do not auto-retry an already claimed send.
        return False
    try:
        table.update_item(
            Key=key,
            UpdateExpression="SET owner_notice = :delivered",
            ConditionExpression="#status = :confirmed AND token_hash = :token AND owner_notice = :claimed",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":delivered": "delivered", ":claimed": "claimed",
                                       ":confirmed": "confirmed", ":token": token_hash},
        )
    except Exception as exc:
        if _conditional_failure(exc):
            return False  # The address may have been withdrawn in the meantime.
        raise
    return True


def _register_launch_notice(payload, origin):
    """Double opt-in on one atomic item; permanently disabled until explicitly enabled."""
    if os.environ.get("ENABLE_POLICYCOCK_SIGNUP") != "true":
        return _response(503, {"error": "registration_not_available"}, origin)
    if origin != "https://policycock.aws.shdkej.com" or payload.get("appId") != "policycock":
        return _response(400, {"error": "invalid_request"}, origin)
    action = payload.get("action")
    if action == "request":
        if payload.get("website"):
            return _response(202, {"ok": True}, origin)
        email = _clean_text(payload.get("replyEmail"), 200).lower()
        if not email or not EMAIL_RE.fullmatch(email) or payload.get("consent") is not True:
            return _response(400, {"error": "invalid_registration"}, origin)
        consent_version = payload.get("consentVersion", "launch-notice-v1")
        if consent_version not in ("launch-notice-v1", "launch-notice-v2"):
            return _response(400, {"error": "invalid_consent_version"}, origin)
        if consent_version == "launch-notice-v2" and not EMAIL_RE.fullmatch(os.environ.get("POLICYCOCK_SIGNUP_OWNER_EMAIL", "")):
            return _response(503, {"error": "registration_not_available"}, origin)
        now = int(datetime.now(timezone.utc).timestamp())
        email_hash = hashlib.sha256(email.encode("utf-8")).hexdigest()
        secret = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(secret.encode("ascii")).hexdigest()
        item = {"email_hash": email_hash, "email": email, "token_hash": token_hash,
                "status": "pending", "created_at": now, "token_expires_at": now + 7 * 86400,
                "ttl": now + 365 * 86400,
                "variant": payload.get("variant") if payload.get("variant") in ("A", "B") else "direct",
                "consent": consent_version, "receipt_id": uuid.uuid4().hex}
        table = _signup_table()
        try:
            table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(email_hash) OR (#status = :pending AND token_expires_at <= :now) OR #ttl <= :now",
                ExpressionAttributeNames={"#status": "status", "#ttl": "ttl"},
                ExpressionAttributeValues={":pending": "pending", ":now": now},
            )
        except Exception as exc:
            if _conditional_failure(exc):
                return _response(202, {"ok": True}, origin)
            raise
        try:
            ses.send_email(
                Source=SENDER_EMAIL, Destination={"ToAddresses": [email]},
                Message={"Subject": {"Data": "[모두의정책] 출시 안내 신청 확인", "Charset": "UTF-8"},
                         "Body": {"Text": {"Data": (
                             "정책알리미 출시 시 1회 안내를 받으려면 아래 링크에서 이메일을 확인해 주세요.\n"
                             f"https://policycock.aws.shdkej.com/#launch-confirm={email_hash}.{secret}\n"
                             "확인 전에는 신청이 완료되지 않습니다. 같은 링크에서 신청 철회도 할 수 있습니다."
                         ), "Charset": "UTF-8"}}},
            )
        except Exception:
            # Delete only our own pending generation: a concurrent confirmation wins.
            try:
                table.delete_item(
                    Key={"email_hash": email_hash},
                    ConditionExpression="#status = :pending AND token_hash = :token",
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={":pending": "pending", ":token": token_hash},
                )
            except Exception as exc:
                if not _conditional_failure(exc):
                    raise
            return _response(503, {"error": "verification_unavailable"}, origin)
        return _response(202, {"ok": True}, origin)

    if action in ("confirm", "withdraw"):
        token = payload.get("token")
        match = TOKEN_RE.fullmatch(token) if isinstance(token, str) else None
        if not match:
            return _response(400, {"error": "invalid_token"}, origin)
        email_hash, secret = match.groups()
        token_hash = hashlib.sha256(secret.encode("ascii")).hexdigest()
        table = _signup_table()
        key = {"email_hash": email_hash}
        if action == "withdraw":
            try:
                table.delete_item(
                    Key=key,
                    ConditionExpression="#status IN (:pending, :confirmed) AND token_hash = :token",
                    ExpressionAttributeNames={"#status": "status"},
                    ExpressionAttributeValues={":pending": "pending", ":confirmed": "confirmed", ":token": token_hash},
                )
            except Exception as exc:
                if not _conditional_failure(exc):
                    raise
                existing = _signup_item(table, email_hash)
                if existing and existing.get("token_hash") != token_hash:
                    return _response(400, {"error": "invalid_token"}, origin)
            # Both the address and its derived key are gone in the same atomic operation.
            return _response(200, {"ok": True}, origin)

        now = int(datetime.now(timezone.utc).timestamp())
        try:
            result = table.update_item(
                Key=key,
                UpdateExpression="SET #status = :confirmed",
                ConditionExpression="#status = :pending AND token_hash = :token AND token_expires_at > :now AND #ttl > :now",
                ExpressionAttributeNames={"#status": "status", "#ttl": "ttl"},
                ExpressionAttributeValues={":pending": "pending", ":confirmed": "confirmed",
                                           ":token": token_hash, ":now": now},
                ReturnValues="ALL_NEW",
            )
            item = result["Attributes"]
        except Exception as exc:
            if not _conditional_failure(exc):
                raise
            item = _signup_item(table, email_hash)
            if not item or item.get("status") != "confirmed" or item.get("token_hash") != token_hash or item.get("ttl", 0) <= now:
                return _response(400, {"error": "invalid_or_expired_token"}, origin)
        if not _notify_owner(table, item, now):
            return _response(503, {"error": "notification_delayed"}, origin)
        return _response(200, {"ok": True}, origin)

    return _response(400, {"error": "invalid_action"}, origin)

def handler(event, context):
    origin = _origin_for(event)
    if origin and ALLOWED_ORIGINS and origin not in ALLOWED_ORIGINS:
        return _response(403, {"error": "origin_not_allowed"}, origin)

    method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", ""))
    )
    if method == "OPTIONS":
        return _response(204, {}, origin)
    if method and method != "POST":
        return _response(405, {"error": "method_not_allowed"}, origin)

    try:
        payload = _read_body(event)
    except Exception:
        return _response(400, {"error": "invalid_json"}, origin)

    if not isinstance(payload, dict):
        return _response(400, {"error": "invalid_json"}, origin)
    if payload.get("type") == "launch-notice":
        return _register_launch_notice(payload, origin)

    message = _clean_text(payload.get("message"), 3000)
    app_id = _clean_app_id(payload.get("appId"))
    app_name = _clean_text(payload.get("appName") or app_id, 120)
    feedback_type = _clean_text(payload.get("type") or "feedback", 40)
    reply_email = _clean_text(payload.get("replyEmail"), 200)
    path = _clean_text(payload.get("path"), 300)
    user_agent = _clean_text(payload.get("userAgent"), 600)
    app_version = _clean_text(payload.get("appVersion") or "unknown", 80)
    stats = payload.get("stats") if isinstance(payload.get("stats"), dict) else {}

    if len(message) < 3:
        return _response(400, {"error": "message_too_short"}, origin)
    if reply_email and not EMAIL_RE.match(reply_email):
        return _response(400, {"error": "invalid_reply_email"}, origin)

    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    month_key = now.strftime("%Y-%m")
    object_key = f"feedback/{app_id}/{month_key}/{now.strftime('%Y%m%dT%H%M%S')}-{quote(feedback_type)}.json"
    csv_key = f"feedback/{app_id}/{month_key}.csv"

    record = {
        "created_at": created_at,
        "app_id": app_id,
        "app_name": app_name,
        "type": feedback_type,
        "message": message,
        "reply_email": reply_email,
        "path": path,
        "user_agent": user_agent,
        "app_version": app_version,
        "stats": {
            "total": stats.get("total"),
            "count": stats.get("count"),
            "today": stats.get("today"),
            "month": stats.get("month"),
        },
        "request_id": getattr(context, "aws_request_id", None),
    }

    s3.put_object(
        Bucket=BUCKET,
        Key=object_key,
        Body=json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json; charset=utf-8",
    )

    _append_monthly_csv(
        csv_key,
        [
            created_at,
            app_id,
            app_name,
            feedback_type,
            path,
            reply_email,
            message.replace("\n", "\\n"),
            app_version,
            record["stats"]["total"],
            record["stats"]["count"],
            user_agent,
            object_key,
        ]
    )

    subject = f"[{app_name}] 새 피드백: {feedback_type}"
    text_body = "\n".join(
        [
            f"created_at: {created_at}",
            f"app_id: {app_id}",
            f"app_name: {app_name}",
            f"type: {feedback_type}",
            f"path: {path}",
            f"reply_email: {reply_email or '-'}",
            f"app_version: {app_version}",
            f"s3_object: s3://{BUCKET}/{object_key}",
            "",
            message,
        ]
    )
    html_body = f"""
<html><body>
  <h2>{app_name} 새 피드백</h2>
  <p><b>app id:</b> {app_id}</p>
  <p><b>type:</b> {feedback_type}</p>
  <p><b>path:</b> {path}</p>
  <p><b>reply email:</b> {reply_email or '-'}</p>
  <p><b>app version:</b> {app_version}</p>
  <p><b>s3 object:</b> s3://{BUCKET}/{object_key}</p>
  <hr />
  <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">{message}</pre>
</body></html>
"""

    email_sent = True
    email_error = ""
    try:
        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": [RECIPIENT_EMAIL]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                },
            },
            ReplyToAddresses=[reply_email] if reply_email else [],
        )
    except Exception as exc:
        email_sent = False
        email_error = exc.__class__.__name__

    body = {"ok": True, "email_sent": email_sent, "object_key": object_key}
    if email_error:
        body["email_error"] = email_error
    return _response(200, body, origin)
