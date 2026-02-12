#!/usr/bin/env python3
# Analyze Google Calendar .ics (no import) to infer recurring task menus per store.
# Output is aggregated; no attendee emails/phones are emitted.

from __future__ import annotations

import argparse
import csv
import html
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class Event:
    summary: str | None = None
    location: str | None = None
    dtstart_raw: str | None = None
    rrule: str | None = None
    description: str | None = None


_UNFOLD_RE = re.compile(r"\r?\n[ \t]")
_PROP_RE = re.compile(r"^([A-Z0-9-]+)(;[^:]*)?:(.*)$")


def unfold_ics(text: str) -> str:
    # RFC5545: lines starting with SP/HTAB are continuations.
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
                        rrule=cur.get("RRULE"),
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
        # Keep last occurrence for same key (Google exports can repeat some props).
        if key in ("SUMMARY", "LOCATION", "DTSTART", "RRULE", "DESCRIPTION"):
            cur[key] = val

    return events


_BRACKET_PREFIX = re.compile(r"^【[^】]+】")


def normalize_store_name(summary: str | None, location: str | None) -> str | None:
    cand = (summary or "").strip()
    if cand:
        cand = _BRACKET_PREFIX.sub("", cand).strip()
        # common separators
        cand = cand.replace("（", "(").replace("）", ")")
        # remove trailing date-like or operational suffixes in parentheses
        cand = re.sub(r"\s*\((火|水|木|金|土|日|月)曜.*?\)\s*$", "", cand)
        cand = re.sub(r"\s*\(.*?定休.*?\)\s*$", "", cand)
        # if still too generic, fallback to location
        if cand and cand not in ("清掃", "定期清掃"):
            return cand

    loc = (location or "").strip()
    if not loc:
        return None
    # take first segment before comma (address follows)
    loc = loc.split(",")[0].strip()
    loc = loc.split("、")[0].strip()
    return loc or None


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def normalize_description(desc: str | None) -> str:
    if not desc:
        return ""
    # Google exports use literal '\n'
    s = desc.replace("\\n", "\n")
    s = html.unescape(s)
    # Strip HTML-ish content if present
    if "<" in s and ">" in s:
        s = _HTML_TAG_RE.sub(" ", s)
    # Normalize whitespace
    s = s.replace("\r", "")
    s = re.sub(r"[ \t]+", " ", s)
    return s


HEADER_RE = re.compile(r"^【([^】]+)】")
BULLET_RE = re.compile(r"^[・\-]\s*(.+)$")


def frequency_bucket(label: str) -> str:
    # coarse buckets for reporting
    t = label
    if any(x in t for x in ("毎日",)):
        return "daily"
    if any(x in t for x in ("毎月", "月1", "1ヶ月")):
        return "monthly"
    if any(x in t for x in ("隔月", "2ヶ月")):
        return "bimonthly"
    if any(x in t for x in ("3ヶ月", "四半期")):
        return "quarterly"
    if any(x in t for x in ("半年", "6ヶ月")):
        return "semiannual"
    if any(x in t for x in ("12ヶ月", "年1", "年 1", "年１")):
        return "annual"
    return "other"


def extract_tasks(desc: str) -> list[tuple[str, str]]:
    """Return list of (freq_bucket, task_text)"""
    tasks: list[tuple[str, str]] = []
    current_label = ""

    for raw in desc.splitlines():
        line = raw.strip()
        if not line:
            continue

        m = HEADER_RE.match(line)
        if m:
            current_label = m.group(1).strip()
            continue

        # bullets
        bm = BULLET_RE.match(line)
        if bm:
            body = bm.group(1).strip()
            # inline freq override in parentheses
            inline = ""
            im = re.search(r"\(([^)]*(毎月|隔月|3ヶ月|四半期|半年|12ヶ月|年1)[^)]*)\)", body)
            if im:
                inline = im.group(1)
                body = re.sub(r"\([^)]*(毎月|隔月|3ヶ月|四半期|半年|12ヶ月|年1)[^)]*\)", "", body).strip()
            label = inline or current_label
            tasks.append((frequency_bucket(label), body))
            continue

        # non-bullet task-like lines that contain frequency markers
        if any(k in line for k in ("毎月", "隔月", "3ヶ月", "四半期", "半年", "12ヶ月", "年1")) and any(
            k in line for k in ("清掃", "回収", "洗浄", "駆除")
        ):
            label = line
            # try to extract just the menu text before parentheses
            body = line
            body = re.sub(r"\([^)]*\)", "", body).strip()
            tasks.append((frequency_bucket(label), body))

    # normalize task text a bit
    out: list[tuple[str, str]] = []
    for fb, t in tasks:
        t = t.strip().strip("※").strip()
        t = re.sub(r"\s+", " ", t)
        if not t:
            continue
        out.append((fb, t))
    return out


def parse_dtstart_month(dtstart_raw: str | None) -> str | None:
    if not dtstart_raw:
        return None
    # dtstart_raw can be like 20211015T230000Z or 20250618T100000
    m = re.match(r"^(\d{4})(\d{2})(\d{2})T", dtstart_raw)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ics", required=True)
    ap.add_argument("--out-md", required=True)
    ap.add_argument("--out-csv", required=True)
    args = ap.parse_args()

    ics_path = Path(args.ics)
    text = unfold_ics(ics_path.read_text(errors="ignore"))
    events = parse_events(text)

    # Filter to cleaning-related events (broad)
    filtered: list[Event] = []
    for ev in events:
        s = (ev.summary or "")
        d = (ev.description or "")
        if ("清掃" in s) or ("定期" in s and "清掃" in s) or ("グリストラップ" in d):
            filtered.append(ev)

    store_stats: dict[str, dict[str, Any]] = {}
    task_counts = Counter()
    store_months = defaultdict(set)
    store_monthly_tasks = defaultdict(Counter)
    store_task_freq = defaultdict(lambda: defaultdict(Counter))  # store -> freq -> task -> count

    for ev in filtered:
        store = normalize_store_name(ev.summary, ev.location)
        if not store:
            continue
        desc = normalize_description(ev.description)
        tasks = extract_tasks(desc)

        month = parse_dtstart_month(ev.dtstart_raw)
        if month:
            store_months[store].add(month)

        # aggregate
        for fb, task in tasks:
            task_counts[(fb, task)] += 1
            store_task_freq[store][fb][task] += 1
            if fb == "monthly":
                store_monthly_tasks[store][task] += 1

    stores = sorted(store_months.keys() | store_task_freq.keys())

    # grist trap inference
    grist_monthly = []
    grist_any = []
    for store in stores:
        monthly_tasks = store_monthly_tasks.get(store, {})
        has_monthly = any("グリストラップ" in t for t in monthly_tasks)
        has_any = any(
            "グリストラップ" in t
            for fb in store_task_freq.get(store, {}).values()
            for t in fb
        )
        if has_any:
            grist_any.append(store)
        if has_monthly:
            grist_monthly.append(store)

    # write CSV
    out_csv = Path(args.out_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "store_name",
            "months_with_events",
            "has_grist_any",
            "has_grist_monthly",
            "monthly_tasks_count",
        ])
        for store in stores:
            months = len(store_months.get(store, set()))
            has_any = store in grist_any
            has_monthly = store in grist_monthly
            monthly_cnt = sum(store_monthly_tasks.get(store, {}).values())
            w.writerow([store, months, int(has_any), int(has_monthly), monthly_cnt])

    # write MD report
    out_md = Path(args.out_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)

    # top tasks by bucket
    top_monthly = [(task, c) for (fb, task), c in task_counts.items() if fb == "monthly"]
    top_monthly.sort(key=lambda x: x[1], reverse=True)

    top_any_grist = []
    for (fb, task), c in task_counts.items():
        if "グリストラップ" in task:
            top_any_grist.append(((fb, task), c))
    top_any_grist.sort(key=lambda x: x[1], reverse=True)

    md_lines: list[str] = []
    md_lines.append("# ICS Task Frequency Report (Draft)\n")
    md_lines.append("このレポートは Google Calendar の `basic.ics` を**取り込みせず**に解析し、店舗ごとの定期メニュー頻度を推定したものです。\n")
    md_lines.append("- 個人情報(ゲストメール/電話等)は出力しない\n- `SUMMARY/LOCATION/DESCRIPTION` から店舗名とメニュー行を抽出\n- 仕様上の注意: RRULE の完全展開は行っていないため、**頻度はメニュー文面(毎月/隔月/四半期…)の記述を正**として扱います\n")

    md_lines.append("## Summary\n")
    md_lines.append(f"- VEVENT total: {len(events)}\n")
    md_lines.append(f"- Cleaning-related events (filtered): {len(filtered)}\n")
    md_lines.append(f"- Unique stores (observed): {len(stores)}\n")

    md_lines.append("## Hypothesis Check: グリストラップ\n")
    md_lines.append(f"- グリストラップ言及あり (any): {len(grist_any)} stores\n")
    md_lines.append(f"- グリストラップが **毎月** に分類された: {len(grist_monthly)} stores\n")
    md_lines.append("\n")

    md_lines.append("### Stores With Monthly グリストラップ\n")
    if grist_monthly:
        for s in grist_monthly[:200]:
            md_lines.append(f"- {s}\n")
        if len(grist_monthly) > 200:
            md_lines.append(f"- ... ({len(grist_monthly)-200} more)\n")
    else:
        md_lines.append("- (none detected by menu text)\n")

    md_lines.append("\n### Stores With グリストラップ Mention But Not Monthly\n")
    only_non_monthly = [s for s in grist_any if s not in grist_monthly]
    if only_non_monthly:
        for s in only_non_monthly[:200]:
            md_lines.append(f"- {s}\n")
        if len(only_non_monthly) > 200:
            md_lines.append(f"- ... ({len(only_non_monthly)-200} more)\n")
    else:
        md_lines.append("- (none)\n")

    md_lines.append("\n## Top Monthly Tasks (by occurrences in menu text)\n")
    for task, c in top_monthly[:30]:
        md_lines.append(f"- {task} ({c})\n")

    md_lines.append("\n## グリストラップ Mentions (by bucket)\n")
    for (fb, task), c in top_any_grist[:20]:
        md_lines.append(f"- [{fb}] {task} ({c})\n")

    md_lines.append("\n## Outputs\n")
    md_lines.append(f"- CSV: `{out_csv.as_posix()}`\n")
    md_lines.append(f"- Note: 店舗名の抽出は SUMMARY 優先で、LOCATION は補助です。\n")

    out_md.write_text("".join(md_lines), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
