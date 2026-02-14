#!/usr/bin/env python3
"""
Sync tenpo address / Google Maps URL from ICS calendar events.

Default is dry-run (no write). Use --apply to PUT updates.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib import parse, request, error


MAP_URL_RE = re.compile(
    r"(https?://(?:www\.)?(?:google\.[^/\s]+/maps[^\s]*|maps\.app\.goo\.gl/[^\s]+|goo\.gl/maps/[^\s]+))",
    re.IGNORECASE,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize_text(v: str) -> str:
    s = (v or "").strip().lower()
    s = s.replace("株式会社", "").replace("(株)", "").replace("㈱", "").replace("有限会社", "").replace("合同会社", "")
    s = re.sub(r"[ \t\r\n　\-‐‑–—_,.、。/\\()（）\[\]【】「」『』・:;!?@#%&*+=~|<>\"']", "", s)
    return s


def decode_ics_value(v: str) -> str:
    s = v.replace("\\n", "\n").replace("\\N", "\n")
    s = s.replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")
    return s.strip()


def unfold_ics_lines(text: str) -> List[str]:
    raw = text.splitlines()
    lines: List[str] = []
    for line in raw:
        if line.startswith(" ") or line.startswith("\t"):
            if lines:
                lines[-1] += line[1:]
            continue
        lines.append(line)
    return lines


def parse_ics_events(path: Path) -> List[dict]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = unfold_ics_lines(text)
    events: List[dict] = []
    cur: Optional[dict] = None
    for line in lines:
        if line == "BEGIN:VEVENT":
            cur = {}
            continue
        if line == "END:VEVENT":
            if cur is not None:
                events.append(cur)
            cur = None
            continue
        if cur is None:
            continue
        if ":" not in line:
            continue
        left, value = line.split(":", 1)
        key = left.split(";", 1)[0].upper()
        cur.setdefault(key, [])
        cur[key].append(decode_ics_value(value))
    return events


def first_val(ev: dict, key: str) -> str:
    vals = ev.get(key) or []
    return vals[0].strip() if vals else ""


def extract_candidate_names(summary: str, location: str, description: str) -> List[str]:
    cands: List[str] = []
    s = summary.strip()
    if s:
        s = re.sub(r"^【[^】]+】", "", s).strip()
        s = re.sub(r"^[\[\(（].*?[\]\)）]\s*", "", s).strip()
        s = s.replace("定期清掃", "").replace("スポット清掃", "").replace("清掃", "").strip()
        cands.extend([x.strip() for x in re.split(r"[|｜/／,、・\n]", s) if x.strip()])

    loc = location.strip()
    if loc:
        loc_head = re.split(r"[,\n]", loc)[0].strip()
        if loc_head:
            cands.append(loc_head)

    # Description fallback: line with 店 / 店舗 / 本店 in first part
    for ln in description.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        if any(k in ln for k in ("店舗", "本店", "店")) and len(ln) <= 40:
            cands.append(ln)

    out: List[str] = []
    seen = set()
    for c in cands:
        if c and c not in seen:
            out.append(c)
            seen.add(c)
    return out


def extract_map_url(location: str, description: str) -> str:
    src = f"{location}\n{description}"
    m = MAP_URL_RE.search(src)
    return m.group(1).strip() if m else ""


def extract_address(location: str, description: str) -> str:
    loc = location.strip()
    loc = MAP_URL_RE.sub("", loc).strip()
    if loc:
        return loc
    for ln in description.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        if "〒" in ln or re.search(r"(都|道|府|県).*(市|区|町|村)", ln):
            return MAP_URL_RE.sub("", ln).strip()
    return ""


@dataclass
class Tenpo:
    tenpo_id: str
    name: str
    address: str
    map_url: str
    raw: dict
    norm: str


def score_match(cand: str, tenpo_norm: str) -> float:
    c = normalize_text(cand)
    if not c or not tenpo_norm:
        return 0.0
    if c == tenpo_norm:
        return 100.0
    if len(c) >= 3 and (c in tenpo_norm or tenpo_norm in c):
        return 88.0 + min(10.0, len(c) * 0.2)
    return SequenceMatcher(None, c, tenpo_norm).ratio() * 100.0


def pick_best_tenpo(cands: List[str], tenpos: List[Tenpo]) -> Tuple[Optional[Tenpo], float, str]:
    best_t: Optional[Tenpo] = None
    best_score = 0.0
    best_c = ""
    for c in cands:
        for t in tenpos:
            sc = score_match(c, t.norm)
            if sc > best_score:
                best_score = sc
                best_t = t
                best_c = c
    return best_t, best_score, best_c


def http_json(method: str, url: str, token: str, body: Optional[dict] = None) -> Tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = request.Request(url, data=data, method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=30) as r:
            text = r.read().decode("utf-8")
            return r.status, json.loads(text) if text else {}
    except error.HTTPError as e:
        try:
            text = e.read().decode("utf-8")
            return e.code, json.loads(text) if text else {}
        except Exception:
            return e.code, {"error": str(e)}


def load_tenpo(base: str, token: str, limit: int) -> List[Tenpo]:
    url = f"{base.rstrip('/')}/master/tenpo?limit={limit}&jotai=yuko"
    st, res = http_json("GET", url, token)
    if st < 200 or st >= 300:
        raise RuntimeError(f"GET tenpo failed: {st} {res}")
    items = res.get("items") or []
    out: List[Tenpo] = []
    for it in items:
        tid = (it.get("tenpo_id") or "").strip()
        name = (it.get("name") or "").strip()
        if not tid or not name:
            continue
        map_url = (it.get("map_url") or it.get("google_map_url") or "").strip()
        out.append(
            Tenpo(
                tenpo_id=tid,
                name=name,
                address=(it.get("address") or "").strip(),
                map_url=map_url,
                raw=it,
                norm=normalize_text(name),
            )
        )
    return out


def main() -> int:
    p = argparse.ArgumentParser(description="Sync tenpo geo info from ICS (dry-run by default).")
    p.add_argument("--ics-path", required=True, help="ICS file path")
    p.add_argument("--base", required=True, help="Master API base (e.g. https://.../prod)")
    p.add_argument("--token-file", default=os.path.expanduser("~/.cognito_token"))
    p.add_argument("--limit-tenpo", type=int, default=20000)
    p.add_argument("--min-score", type=float, default=84.0)
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing address/map_url")
    p.add_argument("--apply", action="store_true", help="Apply updates (default: dry-run)")
    p.add_argument("--report-dir", default="docs/spec")
    args = p.parse_args()

    token = ""
    tf = Path(args.token_file).expanduser()
    if tf.exists():
        token = tf.read_text(encoding="utf-8").strip()

    ics_path = Path(args.ics_path)
    if not ics_path.exists():
        print(f"[ERR] ICS not found: {ics_path}", file=sys.stderr)
        return 2

    tenpos = load_tenpo(args.base, token, args.limit_tenpo)
    events = parse_ics_events(ics_path)
    print(f"[INFO] tenpo={len(tenpos)} events={len(events)} min_score={args.min_score}")

    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    matched_csv = report_dir / f"ics_tenpo_geo_matched_{ts}.csv"
    unmatched_csv = report_dir / f"ics_tenpo_geo_unmatched_{ts}.csv"

    best_by_tenpo: Dict[str, dict] = {}
    unmatched_rows: List[dict] = []
    matched_rows: List[dict] = []

    for idx, ev in enumerate(events, start=1):
        summary = first_val(ev, "SUMMARY")
        location = first_val(ev, "LOCATION")
        description = first_val(ev, "DESCRIPTION")
        cands = extract_candidate_names(summary, location, description)
        t, score, by = pick_best_tenpo(cands, tenpos)
        map_url = extract_map_url(location, description)
        address = extract_address(location, description)
        if not t or score < args.min_score:
            unmatched_rows.append(
                {
                    "event_index": idx,
                    "summary": summary,
                    "location": location,
                    "best_score": f"{score:.1f}",
                    "candidate_names": " | ".join(cands[:5]),
                }
            )
            continue

        row = {
            "event_index": idx,
            "tenpo_id": t.tenpo_id,
            "tenpo_name": t.name,
            "matched_by": by,
            "score": f"{score:.1f}",
            "summary": summary,
            "new_address": address,
            "new_map_url": map_url,
            "old_address": t.address,
            "old_map_url": t.map_url,
        }
        matched_rows.append(row)

        prev = best_by_tenpo.get(t.tenpo_id)
        quality = (1 if map_url else 0) + (1 if address else 0)
        if prev is None or quality > prev["quality"] or (quality == prev["quality"] and score > prev["score"]):
            best_by_tenpo[t.tenpo_id] = {
                "tenpo": t,
                "score": score,
                "matched_by": by,
                "summary": summary,
                "address": address,
                "map_url": map_url,
                "quality": quality,
            }

    updates: List[dict] = []
    for tid, v in best_by_tenpo.items():
        t = v["tenpo"]
        new_address = (v["address"] or "").strip()
        new_map = (v["map_url"] or "").strip()
        body: Dict[str, str] = {}
        if new_address and (args.overwrite or not t.address):
            if new_address != t.address:
                body["address"] = new_address
        if new_map and (args.overwrite or not t.map_url):
            if new_map != t.map_url:
                body["map_url"] = new_map
                body["google_map_url"] = new_map
        if body:
            body["geo_source"] = "ics_import"
            body["geo_updated_at"] = now_iso()
            updates.append(
                {
                    "tenpo_id": t.tenpo_id,
                    "tenpo_name": t.name,
                    "score": v["score"],
                    "matched_by": v["matched_by"],
                    "summary": v["summary"],
                    "body": body,
                    "old_address": t.address,
                    "old_map_url": t.map_url,
                }
            )

    # reports
    with matched_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "event_index",
                "tenpo_id",
                "tenpo_name",
                "matched_by",
                "score",
                "summary",
                "old_address",
                "new_address",
                "old_map_url",
                "new_map_url",
            ],
        )
        w.writeheader()
        w.writerows(matched_rows)
    with unmatched_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["event_index", "summary", "location", "best_score", "candidate_names"],
        )
        w.writeheader()
        w.writerows(unmatched_rows)

    print(
        f"[SUMMARY] matched_events={len(matched_rows)} unmatched_events={len(unmatched_rows)} "
        f"candidate_updates={len(updates)}"
    )
    print(f"[REPORT] matched={matched_csv}")
    print(f"[REPORT] unmatched={unmatched_csv}")

    preview = updates[:20]
    for u in preview:
        fields = ",".join(sorted(u["body"].keys()))
        print(f"[PLAN] {u['tenpo_id']} {u['tenpo_name']} score={u['score']:.1f} fields={fields}")
    if len(updates) > len(preview):
        print(f"[PLAN] ... and {len(updates)-len(preview)} more")

    if not args.apply:
        print("[DRY-RUN] no write. use --apply to PUT updates.")
        return 0

    ok = 0
    ng = 0
    for u in updates:
        tid = u["tenpo_id"]
        url = f"{args.base.rstrip('/')}/master/tenpo/{parse.quote(tid, safe='')}"
        st, res = http_json("PUT", url, token, u["body"])
        if 200 <= st < 300:
            ok += 1
            print(f"[OK] {tid} {u['tenpo_name']}")
        else:
            ng += 1
            print(f"[NG] {tid} status={st} body={str(res)[:200]}")
    print(f"[APPLY] ok={ok} ng={ng}")
    return 0 if ng == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

