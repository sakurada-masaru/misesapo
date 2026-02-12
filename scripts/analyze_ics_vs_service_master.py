#!/usr/bin/env python3
# Compare historical Google Calendar (basic.ics) task text to current service master.
# Produces aggregated frequency + price-weighted ranking; no personal PII output.

from __future__ import annotations

import argparse
import csv
import html
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_UNFOLD_RE = re.compile(r"\r?\n[ \t]")
_PROP_RE = re.compile(r"^([A-Z0-9-]+)(;[^:]*)?:(.*)$")


@dataclass
class Event:
    summary: str | None = None
    location: str | None = None
    dtstart_raw: str | None = None
    description: str | None = None


def unfold_ics(text: str) -> str:
    return _UNFOLD_RE.sub("", text)


def parse_events(text: str) -> list[Event]:
    events: list[Event] = []
    in_event = False
    cur: dict[str, str] = {}

    for line in text.splitlines():
        if line == "BEGIN:VEVENT":
            in_event = True
            cur = {}
            continue
        if line == "END:VEVENT":
            if in_event:
                events.append(
                    Event(
                        summary=cur.get("SUMMARY"),
                        location=cur.get("LOCATION"),
                        dtstart_raw=cur.get("DTSTART"),
                        description=cur.get("DESCRIPTION"),
                    )
                )
            in_event = False
            cur = {}
            continue
        if not in_event:
            continue

        m = _PROP_RE.match(line)
        if not m:
            continue
        key = m.group(1)
        val = m.group(3)
        if key in ("SUMMARY", "LOCATION", "DTSTART", "DESCRIPTION"):
            cur[key] = val

    return events


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def normalize_description(desc: str | None) -> str:
    if not desc:
        return ""
    s = desc.replace("\\n", "\n")
    s = html.unescape(s)
    if "<" in s and ">" in s:
        s = _HTML_TAG_RE.sub(" ", s)
    s = s.replace("\r", "")
    s = re.sub(r"[ \t]+", " ", s)
    return s


HEADER_RE = re.compile(r"^【([^】]+)】")
BULLET_RE = re.compile(r"^[・\-]\s*(.+)$")


def extract_task_lines(desc: str) -> list[str]:
    # Extract bullet items and also some task-like lines.
    tasks: list[str] = []
    current_label = ""

    for raw in desc.splitlines():
        line = raw.strip()
        if not line:
            continue

        m = HEADER_RE.match(line)
        if m:
            current_label = m.group(1).strip()
            continue

        bm = BULLET_RE.match(line)
        if bm:
            body = bm.group(1).strip()
            body = re.sub(r"\([^)]*\)", "", body).strip()  # drop parenthetical months/freq notes
            if current_label:
                # keep label as context for matching if needed
                tasks.append(f"{body}")
            else:
                tasks.append(body)
            continue

        if any(k in line for k in ("清掃", "回収", "洗浄", "駆除")) and len(line) <= 60:
            body = re.sub(r"\([^)]*\)", "", line).strip()
            tasks.append(body)

    # normalize
    out: list[str] = []
    for t in tasks:
        t = re.sub(r"\s+", " ", t).strip("・ ")
        if not t:
            continue
        out.append(t)
    return out


def load_service_master_from_export(path: Path) -> list[dict[str, Any]]:
    """
    Supported formats:
    - DynamoDB scan output JSON (has 'Items' with DynamoDB-typed attributes)
    - Plain list[object] (already normalized)
    - Object with 'items': list[object]
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and isinstance(data.get("Items"), list):
        return [_ddb_item_to_plain(it) for it in (data.get("Items") or [])]
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        items = data.get("items") or []
        return [x for x in items if isinstance(x, dict)]
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    raise ValueError("unsupported service export JSON format")


def _ddb_item_to_plain(item: dict[str, Any]) -> dict[str, Any]:
    # minimal DynamoDB JSON -> python primitives
    out: dict[str, Any] = {}
    for k, v in item.items():
        if not isinstance(v, dict) or len(v) != 1:
            continue
        t, val = next(iter(v.items()))
        if t == "S":
            out[k] = val
        elif t == "N":
            # keep int if possible
            if re.fullmatch(r"-?\d+", val or ""):
                out[k] = int(val)
            else:
                try:
                    out[k] = float(val)
                except Exception:
                    out[k] = val
        elif t == "BOOL":
            out[k] = bool(val)
        elif t == "L":
            out[k] = val
        elif t == "M":
            out[k] = val
    return out


def normalize_key(s: str) -> str:
    s = s.lower()
    s = s.replace("（", "(").replace("）", ")")
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"[^0-9a-zA-Z\u3040-\u30ff\u3400-\u9fff]+", "", s)
    return s


def load_service_master_from_dynamodb(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
    # NOTE: This sandbox cannot reach AWS endpoints. Export the table JSON with aws-cli
    # on the host machine and pass it via --service-export instead.
    raise RuntimeError("AWS scan is not available here; use --service-export")


def load_match_rules(path: Path | None) -> list[dict[str, Any]]:
    if not path:
        return []
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
    except Exception:
        return []
    return []


def match_task_to_service(task: str, services: list[dict[str, Any]], rules: list[dict[str, Any]]) -> str | None:
    key = normalize_key(task)

    # 1) explicit rules (regex)
    for r in rules:
        pat = r.get("pattern")
        sid = r.get("service_id")
        if not pat or not sid:
            continue
        try:
            if re.search(pat, task):
                return str(sid)
        except re.error:
            continue

    # 2) name substring / normalized inclusion
    best: tuple[int, str] | None = None
    for s in services:
        sid = s.get("service_id")
        name = s.get("name") or ""
        if not sid or not name:
            continue
        nkey = normalize_key(str(name))
        if not nkey:
            continue
        if nkey in key or key in nkey:
            score = min(len(nkey), len(key))
            if not best or score > best[0]:
                best = (score, str(sid))

    return best[1] if best else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ics", required=True)
    ap.add_argument("--service-export", default="docs/spec/service_master_export.json")
    ap.add_argument("--match-rules", default="docs/spec/templates/service_match_rules.json")
    ap.add_argument("--out-md", required=True)
    ap.add_argument("--out-csv", required=True)
    ap.add_argument("--out-unmatched", required=True)
    args = ap.parse_args()

    export_path = Path(args.service_export)
    if not export_path.exists():
        raise SystemExit(
            f"service export not found: {export_path}\\n"
            "Run on your machine (outside this sandbox):\\n"
            "  aws dynamodb scan --table-name service --region ap-northeast-1 --output json > docs/spec/service_master_export.json\\n"
        )
    services = load_service_master_from_export(export_path)
    # keep only yuko by default if present
    services_yuko = [s for s in services if (s.get("jotai") in (None, "yuko"))]
    rules = load_match_rules(Path(args.match_rules) if args.match_rules else None)

    svc_by_id = {str(s.get("service_id")): s for s in services_yuko if s.get("service_id")}

    ics_path = Path(args.ics)
    text = unfold_ics(ics_path.read_text(errors="ignore"))
    events = parse_events(text)

    # Filter: focus on cleaning schedule events (broad). We intentionally include non-cleaning tasks if they appear in descriptions.
    filtered: list[Event] = []
    for ev in events:
        s = (ev.summary or "")
        d = (ev.description or "")
        if ("清掃" in s) or ("定期" in s and "清掃" in s) or ("【" in d and "・" in d):
            filtered.append(ev)

    freq = Counter()
    total_price = Counter()  # service_id -> total price proxy
    unmatched = Counter()

    for ev in filtered:
        desc = normalize_description(ev.description)
        tasks = extract_task_lines(desc)
        for t in tasks:
            sid = match_task_to_service(t, services_yuko, rules)
            if not sid:
                unmatched[t] += 1
                continue
            freq[sid] += 1
            price = svc_by_id.get(sid, {}).get("default_price")
            if isinstance(price, (int, float)):
                total_price[sid] += float(price)

    # CSV output
    out_csv = Path(args.out_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "service_id",
            "name",
            "category",
            "default_price",
            "default_duration_min",
            "matched_count",
            "total_price_proxy",
        ])
        for sid, c in freq.most_common():
            s = svc_by_id.get(sid, {})
            w.writerow(
                [
                    sid,
                    s.get("name", ""),
                    s.get("category", ""),
                    s.get("default_price", ""),
                    s.get("default_duration_min", ""),
                    c,
                    round(total_price.get(sid, 0.0), 2),
                ]
            )

    out_unmatched = Path(args.out_unmatched)
    out_unmatched.parent.mkdir(parents=True, exist_ok=True)
    with out_unmatched.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["task_text", "count"])
        for t, c in unmatched.most_common(200):
            w.writerow([t, c])

    # MD output
    out_md = Path(args.out_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)

    top_freq = freq.most_common(20)
    # cost: by total (count * default_price) proxy, but we computed by adding default_price each match.
    top_cost = total_price.most_common(20)

    md: list[str] = []
    md.append("# ICS vs Service Master Analysis (Draft)\n\n")
    md.append("この分析は Google Calendar `basic.ics` の過去情報から抽出した作業メニューを、DynamoDB `service` マスタに照合して集計したものです。\n\n")
    md.append("前提/注意:\n")
    md.append("- ここでの `total_price_proxy` は `default_price` を1回発生ごとに加算したもの（原価ではなく金額の代理指標）\n")
    md.append("- 予定の本文は自由記述なので、照合は **ルール + 部分一致** の暫定\n")
    md.append("- 未マッチ作業は `docs/spec/ics_unmatched_tasks.csv` に上位200を出力\n\n")

    md.append("## Inputs\n")
    md.append(f"- ICS: `{ics_path}`\n")
    md.append(f"- service export: `{export_path.as_posix()}`\n")
    md.append(f"- services loaded (jotai=yuko): {len(services_yuko)}\n")
    md.append(f"- events (total): {len(events)}\n")
    md.append(f"- events (filtered): {len(filtered)}\n\n")

    md.append("## View 1: Frequency (most frequent matched services)\n")
    if not top_freq:
        md.append("- (no matches) サービス名の一致ルールが足りない可能性が高い\n")
    else:
        for sid, c in top_freq:
            s = svc_by_id.get(sid, {})
            md.append(f"- {sid} {s.get('name','')} (count={c}, price={s.get('default_price','')}, duration={s.get('default_duration_min','')})\n")

    md.append("\n## View 2: Cost Proxy (highest total_price_proxy)\n")
    if not top_cost:
        md.append("- (no priced matches) default_price が入っていない/一致していない\n")
    else:
        for sid, p in top_cost:
            s = svc_by_id.get(sid, {})
            md.append(f"- {sid} {s.get('name','')} (total_price_proxy={round(p,2)}, price={s.get('default_price','')}, count={freq.get(sid,0)})\n")

    md.append("\n## Unmatched (top 30)\n")
    for t, c in unmatched.most_common(30):
        md.append(f"- {t} (count={c})\n")

    md.append("\n## Outputs\n")
    md.append(f"- CSV (matched): `{out_csv.as_posix()}`\n")
    md.append(f"- CSV (unmatched): `{out_unmatched.as_posix()}`\n")

    out_md.write_text("".join(md), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
