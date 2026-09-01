import base64
import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


s3 = boto3.client("s3")

BUCKET = os.environ["ACTION_BUCKET"]
ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}
ALLOWED_ACTIONS = {
    "resolve_waiting",
    "archive_request",
    "refresh_dashboard",
    "knowledge_research",
}
ACTION_TOKEN_SHA256 = os.environ.get("ACTION_TOKEN_SHA256", "").strip().lower()
INTENT_ID_RE = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d+$")
# Agent Wiki loop IDs identify a log event, not an Infinity task. They have a
# separate grammar and dedupe boundary.
KNOWLEDGE_LOOP_ID_RE = re.compile(r"^kl-loop-[a-z0-9]+(?:-[a-z0-9]+)+$")
ACTION_RE = re.compile(r"^[a-z][a-z0-9_]{1,48}$")


def _origin_for(event):
    headers = event.get("headers") or {}
    return headers.get("origin") or headers.get("Origin") or ""


def _response(status, body, origin=""):
    headers = {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
    }
    return {
        "statusCode": status,
        "headers": headers,
        "body": "" if status == 204 else json.dumps(body, ensure_ascii=False),
    }


def _read_body(event):
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    return json.loads(body)


def _clean_text(value, max_len):
    if value is None:
        return ""
    return str(value).replace("\x00", "").strip()[:max_len]


def _method_for(event):
    return (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", ""))
    )


def _header_for(event, name):
    headers = event.get("headers") or {}
    target = name.lower()
    for key, value in headers.items():
        if str(key).lower() == target:
            return value or ""
    return ""


def _authorized(event, payload):
    if not ACTION_TOKEN_SHA256:
        return False
    token = _clean_text(
        _header_for(event, "x-infinity-action-key") or payload.get("action_key"),
        512,
    )
    if not token:
        return False
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return hmac.compare_digest(digest, ACTION_TOKEN_SHA256)


def handler(event, context):
    origin = _origin_for(event)
    if ALLOWED_ORIGINS and (not origin or origin not in ALLOWED_ORIGINS):
        return _response(403, {"error": "origin_not_allowed"}, origin)

    method = _method_for(event)
    if method == "OPTIONS":
        return _response(204, {}, origin)
    if method and method != "POST":
        return _response(405, {"error": "method_not_allowed"}, origin)

    try:
        payload = _read_body(event)
    except Exception:
        return _response(400, {"error": "invalid_json"}, origin)

    if not _authorized(event, payload):
        return _response(401, {"error": "unauthorized"}, origin)

    intent_id = _clean_text(payload.get("intent_id") or payload.get("intentId"), 80)
    action = _clean_text(payload.get("action"), 64)
    source = _clean_text(payload.get("source") or "dashboard", 80)
    page = _clean_text(payload.get("page") or payload.get("path"), 400)
    title = _clean_text(payload.get("title"), 240)
    note = _clean_text(payload.get("note"), 1000)
    user_agent = _clean_text((event.get("headers") or {}).get("user-agent"), 600)

    # Wiki loop events are stable IDs; each event has its own dedupe boundary.
    is_knowledge_research = action == "knowledge_research"
    if not (KNOWLEDGE_LOOP_ID_RE.match(intent_id) if is_knowledge_research else INTENT_ID_RE.match(intent_id)):
        return _response(400, {"error": "invalid_intent_id"}, origin)
    if not ACTION_RE.match(action) or action not in ALLOWED_ACTIONS:
        return _response(400, {"error": "unsupported_action"}, origin)
    if is_knowledge_research and not KNOWLEDGE_LOOP_ID_RE.match(intent_id):
        return _response(400, {"error": "invalid_knowledge_loop"}, origin)

    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    request_id = str(uuid.uuid4())
    object_key = (
        "action_requests/inbox/"
        f"{now.strftime('%Y/%m/%d/%Y%m%dT%H%M%SZ')}-{intent_id}-{action}-{request_id}.json"
    )
    dedupe_key = f"action_requests/dedupe/{intent_id}/{action}.json"
    record = {
        "request_id": request_id,
        "created_at": created_at,
        "status": "queued",
        "intent_id": intent_id,
        "action": action,
        "source": source,
        "page": page,
        "title": title,
        "note": note,
        "safety": {
            "public_action": False,
            "external_mutation": False,
            "requires_agent_validation": True,
        },
        "request": {
            "origin": origin,
            "user_agent": user_agent,
            "aws_request_id": getattr(context, "aws_request_id", None),
        },
    }

    try:
        s3.put_object(
            Bucket=BUCKET,
            Key=dedupe_key,
            Body=json.dumps(
                {
                    "request_id": request_id,
                    "created_at": created_at,
                    "intent_id": intent_id,
                    "action": action,
                    "status": "queued",
                },
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8"),
            ContentType="application/json; charset=utf-8",
            ServerSideEncryption="AES256",
            IfNoneMatch="*",
        )
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in {"PreconditionFailed", "ConditionalRequestConflict"}:
            return _response(
                200,
                {
                    "ok": True,
                    "status": "already_queued",
                    "request_id": "",
                    "object_key": "",
                },
                origin,
            )
        raise

    s3.put_object(
        Bucket=BUCKET,
        Key=object_key,
        Body=json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json; charset=utf-8",
        ServerSideEncryption="AES256",
    )

    return _response(
        200,
        {
            "ok": True,
            "status": "queued",
            "request_id": request_id,
            "object_key": object_key,
        },
        origin,
    )
