"""Deploy the isolated Policycock signup backend using AWS CLI v2."""
import argparse
import ast
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from time import sleep
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zipfile import ZipFile

REGION = "ap-northeast-2"
FUNCTION = "policycock-launch-signup"
TABLE = "policycock-launch-registrations"
GROUP = "/aws/lambda/" + FUNCTION
ORIGIN = "https://policycock.aws.shdkej.com"
HANDLER = "policycock_signup.handler"
CORS = {"AllowOrigins": [ORIGIN], "AllowMethods": ["POST"], "AllowHeaders": ["content-type"], "MaxAge": 600}


def aws(service, operation, *options, absent=()):
    command = ["aws", service, operation, "--region", REGION, "--output", "json", *options]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        match = re.search(r"An error occurred \(([^)]+)\)", result.stderr)
        code = match.group(1) if match else "CLI failure"
        if code in absent:
            return None
        # Configuration responses can include sensitive environment values.
        raise RuntimeError(f"{service} {operation} failed: {code}")
    return json.loads(result.stdout) if result.stdout.strip() else {}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def prepare_table(account):
    key = [{"AttributeName": "email_hash", "KeyType": "HASH"}]
    attributes = [{"AttributeName": "email_hash", "AttributeType": "S"}]
    args = ["--table-name", TABLE]
    record = aws("dynamodb", "describe-table", *args, absent=("ResourceNotFoundException",))
    if record is None:
        aws("dynamodb", "create-table", *args, "--attribute-definitions", json.dumps(attributes),
            "--key-schema", json.dumps(key), "--billing-mode", "PAY_PER_REQUEST", "--deletion-protection-enabled")
    aws("dynamodb", "wait", "table-exists", *args)
    table = aws("dynamodb", "describe-table", *args)["Table"]
    require(table["TableArn"] == f"arn:aws:dynamodb:{REGION}:{account}:table/{TABLE}"
            and table["KeySchema"] == key and table["AttributeDefinitions"] == attributes
            and table.get("DeletionProtectionEnabled") and table["TableStatus"] == "ACTIVE"
            and table.get("BillingModeSummary", {}).get("BillingMode") == "PAY_PER_REQUEST",
            "Unexpected signup table schema, billing mode or deletion protection")
    ttl = aws("dynamodb", "describe-time-to-live", *args)["TimeToLiveDescription"]
    if ttl["TimeToLiveStatus"] == "DISABLED":
        aws("dynamodb", "update-time-to-live", *args, "--time-to-live-specification", "Enabled=true,AttributeName=ttl")
        for _ in range(10):
            ttl = aws("dynamodb", "describe-time-to-live", *args)["TimeToLiveDescription"]
            if ttl["TimeToLiveStatus"] != "DISABLED":
                break
            sleep(2)
    require(ttl["TimeToLiveStatus"] in {"ENABLING", "ENABLED"} and ttl.get("AttributeName") == "ttl",
            "TTL is not configured on ttl")


def prepare_function(role, owner, workdir, package, mode):
    args = ["--function-name", FUNCTION]
    env = {"POLICYCOCK_SIGNUP_OWNER_EMAIL": owner, "POLICYCOCK_SIGNUP_TABLE": TABLE,
           "ENABLE_POLICYCOCK_SIGNUP": str(mode == "open").lower()}
    envfile = workdir / "environment.json"
    envfile.write_text(json.dumps({"Variables": env}))
    envfile.chmod(0o600)
    code_hash = base64.b64encode(hashlib.sha256(package.read_bytes()).digest()).decode()
    settings = ["--runtime", "python3.12", "--handler", HANDLER, "--role", role, "--timeout", "15",
                "--memory-size", "128", "--environment", "file://" + str(envfile)]
    config = aws("lambda", "get-function-configuration", *args, absent=("ResourceNotFoundException",))
    if config is None:
        aws("lambda", "create-function", *args, *settings, "--zip-file", "fileb://" + str(package))
        aws("lambda", "wait", "function-active-v2", *args)
    else:
        require(config["Role"] == role and config["Handler"] == HANDLER and
                config.get("Environment", {}).get("Variables", {}).get("ENABLE_POLICYCOCK_SIGNUP") in ("false", "true"),
                "Unexpected signup function ownership or configuration")
        aws("lambda", "wait", "function-updated-v2", *args)
        if config["CodeSha256"] != code_hash:
            aws("lambda", "update-function-code", *args, "--revision-id", config["RevisionId"],
                "--zip-file", "fileb://" + str(package))
            aws("lambda", "wait", "function-updated-v2", *args)
            config = aws("lambda", "get-function-configuration", *args)
        if (config.get("Environment", {}).get("Variables") != env or config["Runtime"] != "python3.12"
                or config["Timeout"] != 15 or config["MemorySize"] != 128):
            aws("lambda", "update-function-configuration", *args, *settings, "--revision-id", config["RevisionId"])
            aws("lambda", "wait", "function-updated-v2", *args)
    final = aws("lambda", "get-function-configuration", *args)
    require(final["State"] == "Active" and final.get("LastUpdateStatus", "Successful") == "Successful"
            and final["CodeSha256"] == code_hash and final["Role"] == role and final["Handler"] == HANDLER
            and final["Environment"]["Variables"] == env, "Deployed Lambda configuration or package mismatch")
    return final["FunctionArn"]


def read_policy():
    policy = aws("lambda", "get-policy", "--function-name", FUNCTION, absent=("ResourceNotFoundException",))
    if policy is None:
        return {}, None
    return {s["Sid"]: s for s in json.loads(policy["Policy"])["Statement"]}, policy["RevisionId"]


def cors_matches(actual):
    # Lambda can omit empty/default CORS fields or return them explicitly.
    return (all(actual.get(key) == value for key, value in CORS.items())
            and not actual.get("AllowCredentials") and not actual.get("ExposeHeaders"))


def prepare_url(function_arn):
    args = ["--function-name", FUNCTION]
    expected = {
        "PolicycockPublicUrl": ("lambda:InvokeFunctionUrl", {"StringEquals": {"lambda:FunctionUrlAuthType": "NONE"}}, ["--function-url-auth-type", "NONE"]),
        "PolicycockViaUrlOnly": ("lambda:InvokeFunction", {"Bool": {"lambda:InvokedViaFunctionUrl": "true"}}, ["--invoked-via-function-url"])
    }
    def check_policy():
        statements, revision = read_policy()
        require(not (statements.keys() - expected.keys()), "Unexpected permission on dedicated Lambda")
        for sid, statement in statements.items():
            action, conditions, _ = expected[sid]
            require(statement.get("Action") == action and statement.get("Effect") == "Allow"
                    and statement.get("Principal") == "*" and statement.get("Resource") == function_arn
                    and statement.get("Condition") == conditions, "Unexpected scope on dedicated Lambda policy")
        return statements, revision

    check_policy()
    url = aws("lambda", "get-function-url-config", *args, absent=("ResourceNotFoundException",))
    url_args = ["--auth-type", "NONE", "--cors", json.dumps(CORS)]
    if url is None:
        aws("lambda", "create-function-url-config", *args, *url_args)
    elif url["AuthType"] != "NONE" or not cors_matches(url.get("Cors", {})):
        aws("lambda", "update-function-url-config", *args, *url_args)
    for sid, (action, _, condition_args) in expected.items():
        statements, revision = check_policy()
        if sid not in statements:
            version = ["--revision-id", revision] if revision else []
            aws("lambda", "add-permission", *args, "--statement-id", sid, "--action", action,
                "--principal", "*", *condition_args, *version)
    statements, _ = check_policy()
    require(statements.keys() == expected.keys(), "Missing public URL permissions")
    config = aws("lambda", "get-function-url-config", *args)
    require(config["FunctionArn"] == function_arn and config["AuthType"] == "NONE" and cors_matches(config.get("Cors", {}))
            and re.fullmatch(r"https://[a-z0-9]{26,40}\.lambda-url\.ap-northeast-2\.on\.aws/", config["FunctionUrl"]),
            "Unexpected signup URL configuration")
    return config["FunctionUrl"]


def verify_api(url, mode):
    preflight = Request(url, method="OPTIONS", headers={"Origin": ORIGIN,
                        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    request = Request(url, method="POST", headers={"Origin": ORIGIN, "Content-Type": "application/json"},
                      data=json.dumps({"appId": "policycock", "type": "launch-notice", "action": "request",
                                       "consentVersion": "launch-notice-v3"}).encode())
    for _ in range(12):
        try:
            with urlopen(preflight, timeout=10) as reply:
                methods = {v.strip().upper() for v in reply.headers.get("Access-Control-Allow-Methods", "").split(",")}
                headers = {v.strip().lower() for v in reply.headers.get("Access-Control-Allow-Headers", "").split(",")}
                require(reply.headers.get("Access-Control-Allow-Origin") == ORIGIN and "POST" in methods
                        and "content-type" in headers, "Incorrect preflight response")
            try:
                with urlopen(request, timeout=10):
                    raise RuntimeError("API accepted a request without an email address")
            except HTTPError as error:
                expected = (400, "invalid_registration") if mode == "open" else (503, "registration_not_available")
                if error.code == expected[0] and error.headers.get("Access-Control-Allow-Origin") == ORIGIN:
                    if json.loads(error.read()).get("error") == expected[1]:
                        return
        except HTTPError as error:
            if error.code != 403:
                raise
        sleep(5)
    raise RuntimeError("Expected registration contract was not observed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--mode", choices=("open", "closed"), default="closed")
    args = parser.parse_args()
    package = args.package.resolve()
    require(package.stat().st_size < 1024 * 1024, "Unexpected archive size")
    with ZipFile(package) as archive:
        require(archive.namelist() == ["policycock_signup.py"] and archive.testzip() is None,
                "Expected an isolated signup handler package")
        info = archive.getinfo("policycock_signup.py")
        require(0 < info.file_size < 1024 * 1024, "Invalid signup source size")
        module = ast.parse(archive.read(info))
        require(any(isinstance(node, ast.FunctionDef) and node.name == "handler" for node in module.body),
                "Missing signup handler")
    owner = os.environ["POLICYCOCK_OWNER_EMAIL"]
    require(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", owner), "Invalid owner/sender configuration")
    identity = aws("sts", "get-caller-identity")
    account = identity["Account"]
    deploy_role = os.environ["DEPLOY_ROLE_ARN"]
    role_pattern = rf"arn:aws:iam::{re.escape(account)}:role/(?:[\w+=,.@-]+/)*([\w+=,.@-]+)"
    match = re.fullmatch(role_pattern, deploy_role)
    require(match and identity["Arn"] == f"arn:aws:sts::{account}:assumed-role/{match[1]}/PolicycockSignupDeploy",
            "Unexpected deployment identity")
    role = f"arn:aws:iam::{account}:role/PolicycockSignupRuntime"
    require(aws("iam", "get-role", "--role-name", "PolicycockSignupRuntime")["Role"]["Arn"] == role,
            "Unexpected execution role")
    prepare_table(account)
    aws("logs", "create-log-group", "--log-group-name", GROUP, absent=("ResourceAlreadyExistsException",))
    aws("logs", "put-retention-policy", "--log-group-name", GROUP, "--retention-in-days", "14")
    with TemporaryDirectory() as temp:
        function_arn = prepare_function(role, owner, Path(temp), package, args.mode)
    require(function_arn == f"arn:aws:lambda:{REGION}:{account}:function:{FUNCTION}", "Unexpected dedicated function ARN")
    url = prepare_url(function_arn)
    verify_api(url, args.mode)
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        print("url=" + url, file=output)
    print(f"Verified {args.mode} registration, dedicated deployment, CORS and public HTTPS endpoint:", url)


if __name__ == "__main__":
    main()
