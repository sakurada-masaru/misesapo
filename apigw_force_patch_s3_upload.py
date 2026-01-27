import json, subprocess, shlex, re

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
TARGET="misesapo-s3-upload"

def run(cmd):
    p = subprocess.run(shlex.split(cmd), capture_output=True, text=True)
    if p.returncode != 0:
        return ""
    return p.stdout

def j(s): return json.loads(s)

resources = j(run(f"aws apigateway get-resources --rest-api-id {REST_API_ID} --region {REGION}"))

items = resources.get("items", [])
patches = []

for it in items:
    rid = it["id"]
    path = it.get("path","")
    methods = it.get("resourceMethods") or {}

    for method in methods:
        if method == "OPTIONS":
            continue

        raw = run(f"aws apigateway get-integration --rest-api-id {REST_API_ID} "
                  f"--resource-id {rid} --http-method {method} --region {REGION}")
        if not raw.strip():
            continue

        integ = j(raw)
        uri = integ.get("uri","")

        if TARGET not in uri:
            continue

        m = re.search(r"arn:aws:lambda:[^:]+:(\d+):function:"+TARGET, uri)
        if not m:
            continue

        acct = m.group(1)

        new_uri = (
            f"arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/"
            f"arn:aws:lambda:{REGION}:{acct}:function:{TARGET}:${{stageVariables.lambdaAlias}}/invocations"
        )

        if uri != new_uri:
            patches.append((path, method, rid, uri, new_uri))


print(f"[PLAN] patch count = {len(patches)}")

for p in patches:
    print(f"- {p[0]} {p[1]}")
    print(" OLD:", p[3])
    print(" NEW:", p[4])

print("\n[APPLY]")

for path, method, rid, old, new in patches:
    cmd = (
        f"aws apigateway update-integration "
        f"--rest-api-id {REST_API_ID} "
        f"--resource-id {rid} "
        f"--http-method {method} "
        f"--region {REGION} "
        f"--patch-operations op=replace,path=/uri,value={shlex.quote(new)}"
    )
    run(cmd)

print("[DONE]")
