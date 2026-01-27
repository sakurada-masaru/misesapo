import json, subprocess, shlex, re, sys

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
TARGET_FUNC="misesapo-s3-upload"

def run(cmd: str) -> str:
    p = subprocess.run(shlex.split(cmd), capture_output=True, text=True)
    if p.returncode != 0:
        print(p.stderr.strip())
        return ""
    return p.stdout

def j(s): return json.loads(s)

resources_raw = run(f"aws apigateway get-resources --rest-api-id {REST_API_ID} --region {REGION} --output json")
items = j(resources_raw).get("items", []) if resources_raw else []

changes = []

for it in items:
    rid = it["id"]
    path = it.get("path","")
    methods = it.get("resourceMethods") or {}
    for method in methods.keys():
        if method == "OPTIONS":
            continue
        integ_raw = run(f"aws apigateway get-integration --rest-api-id {REST_API_ID} --resource-id {rid} --http-method {method} --region {REGION} --output json")
        if not integ_raw.strip():
            continue
        integ = j(integ_raw)
        uri = integ.get("uri","")
        if f":function:{TARGET_FUNC}/invocations" not in uri:
            continue

        m = re.search(r"arn:aws:lambda:[^:]+:(\d+):function:"+re.escape(TARGET_FUNC), uri)
        if not m:
            continue
        acct = m.group(1)

        new_uri = f"arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:{REGION}:{acct}:function:{TARGET_FUNC}:${{stageVariables.lambdaAlias}}/invocations"
        if uri != new_uri:
            changes.append((path, method, rid, uri, new_uri))

print(f"[PLAN] Will patch {len(changes)} integrations for {TARGET_FUNC}")
for (path, method, rid, old, new) in changes:
    print(f"- {path} {method}")
    print(f"  resourceId={rid}")
    print(f"  OLD: {old}")
    print(f"  NEW: {new}")

if not changes:
    print("[DONE] Nothing to patch.")
    sys.exit(0)

print("\n[APPLY] Patching...")
for (path, method, rid, old, new) in changes:
    cmd = (
        f"aws apigateway update-integration "
        f"--rest-api-id {REST_API_ID} "
        f"--resource-id {rid} "
        f"--http-method {method} "
        f"--region {REGION} "
        f"--patch-operations op=replace,path=/uri,value={shlex.quote(new)}"
    )
    run(cmd)

print("[DONE] update-integration complete.")
