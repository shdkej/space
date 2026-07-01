import base64
import csv
import io
import json
import os
import re
from datetime import datetime, timezone
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
