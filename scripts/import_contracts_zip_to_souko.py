#!/usr/bin/env python3
"""
ZIP内の契約書ファイルを店舗soukoへ一括投入するユーティリティ。

仕様:
- デフォルトは dry-run（書き込みなし）
- ZIP内ファイル名を tenpo / torihikisaki 名で照合
- --apply 指定時のみ:
  1) soukoレコード確保
  2) presign発行
  3) S3 PUT
  4) souko.files へ追記
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import mimetypes
import os
import re
import sys
import unicodedata
import zipfile
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen


def now_iso() -> str:
    return dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def normalize_text(v: str) -> str:
    s = unicodedata.normalize("NFKC", str(v or "")).lower().strip()
    s = s.replace("株式会社", "")
    s = s.replace("(株)", "")
    s = s.replace("合同会社", "")
    s = s.replace("有限会社", "")
    s = s.replace("契約書", "")
    s = s.replace("店舗ごと", "")
    s = s.replace("店舗別", "")
    s = re.sub(r"[「」『』【】\[\]\(\)（）_・/\\\-.,:;!?　\s]+", "", s)
    return s


def api_json(method: str, url: str, token: str | None = None, body: dict[str, Any] | None = None) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url=url, data=data, method=method.upper(), headers=headers)
    with urlopen(req, timeout=60) as res:
        raw = res.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def put_binary(url: str, content: bytes, content_type: str) -> int:
    req = Request(
        url=url,
        data=content,
        method="PUT",
        headers={
            "Content-Type": content_type or "application/octet-stream",
        },
    )
    with urlopen(req, timeout=180) as res:
        return int(getattr(res, "status", 200) or 200)


def as_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        v = payload.get("items")
        if isinstance(v, list):
            return [x for x in v if isinstance(x, dict)]
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    return []


def score(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 100.0
    ratio = SequenceMatcher(None, a, b).ratio() * 100.0
    if a in b or b in a:
        ratio = max(ratio, 92.0)
    return ratio


@dataclass
class TenpoRow:
    tenpo_id: str
    tenpo_name: str
    tenpo_norm: str
    torihikisaki_id: str
    torihikisaki_name: str
    torihikisaki_norm: str


@dataclass
class MatchPlan:
    zip_path: str
    file_name: str
    file_size: int
    tenpo_id: str
    tenpo_name: str
    torihikisaki_id: str
    torihikisaki_name: str
    score: float
    strategy: str


def load_master(base: str, token: str) -> list[TenpoRow]:
    tori_map: dict[str, str] = {}
    tori_items = as_items(api_json("GET", f"{base.rstrip('/')}/master/torihikisaki?limit=8000&jotai=yuko", token))
    for t in tori_items:
        tid = str(t.get("torihikisaki_id") or "").strip()
        if not tid:
            continue
        tori_map[tid] = str(t.get("name") or "").strip()

    tenpo_items = as_items(api_json("GET", f"{base.rstrip('/')}/master/tenpo?limit=20000&jotai=yuko", token))
    rows: list[TenpoRow] = []
    for tp in tenpo_items:
        tenpo_id = str(tp.get("tenpo_id") or "").strip()
        tenpo_name = str(tp.get("name") or "").strip()
        tori_id = str(tp.get("torihikisaki_id") or "").strip()
        tori_name = tori_map.get(tori_id, "")
        if not tenpo_id:
            continue
        rows.append(
            TenpoRow(
                tenpo_id=tenpo_id,
                tenpo_name=tenpo_name,
                tenpo_norm=normalize_text(tenpo_name),
                torihikisaki_id=tori_id,
                torihikisaki_name=tori_name,
                torihikisaki_norm=normalize_text(tori_name),
            )
        )
    return rows


def build_plan(zip_file: Path, tenpo_rows: list[TenpoRow], min_score: float) -> tuple[list[MatchPlan], list[dict[str, Any]]]:
    plans: list[MatchPlan] = []
    unmatched: list[dict[str, Any]] = []

    with zipfile.ZipFile(zip_file, "r") as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            file_name = Path(info.filename).name
            raw_base = Path(file_name).stem
            norm_base = normalize_text(raw_base)
            if not norm_base:
                unmatched.append({"zip_path": info.filename, "file_name": file_name, "reason": "normalized_name_empty"})
                continue

            best_row: TenpoRow | None = None
            best_score = -1.0
            best_strategy = ""
            for row in tenpo_rows:
                s_tenpo = score(norm_base, row.tenpo_norm)
                s_tori = score(norm_base, row.torihikisaki_norm)
                s_combo = score(norm_base, normalize_text(f"{row.torihikisaki_name}{row.tenpo_name}"))
                if s_combo >= s_tenpo and s_combo >= s_tori:
                    s = s_combo
                    strategy = "combo"
                elif s_tenpo >= s_tori:
                    s = s_tenpo
                    strategy = "tenpo"
                else:
                    s = s_tori
                    strategy = "torihikisaki"
                if s > best_score:
                    best_score = s
                    best_row = row
                    best_strategy = strategy

            if not best_row or best_score < min_score:
                unmatched.append(
                    {
                        "zip_path": info.filename,
                        "file_name": file_name,
                        "reason": f"low_score<{min_score}",
                        "best_score": round(best_score, 2),
                        "best_tenpo_id": best_row.tenpo_id if best_row else "",
                        "best_tenpo_name": best_row.tenpo_name if best_row else "",
                        "best_torihikisaki_name": best_row.torihikisaki_name if best_row else "",
                    }
                )
                continue

            plans.append(
                MatchPlan(
                    zip_path=info.filename,
                    file_name=file_name,
                    file_size=info.file_size,
                    tenpo_id=best_row.tenpo_id,
                    tenpo_name=best_row.tenpo_name,
                    torihikisaki_id=best_row.torihikisaki_id,
                    torihikisaki_name=best_row.torihikisaki_name,
                    score=best_score,
                    strategy=best_strategy,
                )
            )
    return plans, unmatched


def ensure_souko(base: str, token: str, tenpo_id: str, tenpo_name: str) -> dict[str, Any]:
    q = quote(tenpo_id, safe="")
    found = as_items(api_json("GET", f"{base.rstrip('/')}/master/souko?limit=20&jotai=yuko&tenpo_id={q}", token))
    if found:
        return found[0]
    return api_json(
        "POST",
        f"{base.rstrip('/')}/master/souko",
        token,
        {
            "tenpo_id": tenpo_id,
            "name": f"{tenpo_name or tenpo_id} 顧客ストレージ",
            "jotai": "yuko",
        },
    )


def append_file_meta(
    base: str,
    token: str,
    souko: dict[str, Any],
    file_meta: dict[str, Any],
) -> None:
    souko_id = str(souko.get("souko_id") or "").strip()
    if not souko_id:
        raise RuntimeError("souko_id missing")
    files = souko.get("files")
    if not isinstance(files, list):
        files = []

    file_key = str(file_meta.get("key") or "")
    file_name = str(file_meta.get("file_name") or "")
    exists = any(
        str(x.get("key") or "") == file_key or (file_name and str(x.get("file_name") or "") == file_name)
        for x in files
        if isinstance(x, dict)
    )
    if not exists:
        files = [*files, file_meta]

    body = {**souko, "files": files}
    sid = quote(souko_id, safe="")
    api_json("PUT", f"{base.rstrip('/')}/master/souko/{sid}", token, body)


def apply_plan(zip_file: Path, plans: list[MatchPlan], base: str, token: str) -> tuple[int, int]:
    ok = 0
    ng = 0
    with zipfile.ZipFile(zip_file, "r") as zf:
        for p in plans:
            try:
                content = zf.read(p.zip_path)
                ctype = mimetypes.guess_type(p.file_name)[0] or "application/octet-stream"
                souko = ensure_souko(base, token, p.tenpo_id, p.tenpo_name)

                presign = api_json(
                    "POST",
                    f"{base.rstrip('/')}/master/souko",
                    token,
                    {
                        "mode": "presign_upload",
                        "tenpo_id": p.tenpo_id,
                        "file_name": p.file_name,
                        "content_type": ctype,
                    },
                )
                put_url = str(presign.get("put_url") or "")
                key = str(presign.get("key") or "")
                if not put_url or not key:
                    raise RuntimeError("presign response missing put_url/key")

                status = put_binary(put_url, content, ctype)
                if status < 200 or status >= 300:
                    raise RuntimeError(f"S3 PUT failed status={status}")

                append_file_meta(
                    base,
                    token,
                    souko,
                    {
                        "key": key,
                        "file_name": p.file_name,
                        "content_type": ctype,
                        "size": len(content),
                        "uploaded_at": now_iso(),
                        "kubun": "keiyakusho",
                    },
                )
                print(f"[OK] {p.file_name} -> {p.tenpo_id} {p.tenpo_name}")
                ok += 1
            except Exception as e:  # noqa: BLE001
                print(f"[NG] {p.file_name} -> {p.tenpo_id} {p.tenpo_name}: {e}", file=sys.stderr)
                ng += 1
    return ok, ng


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        path.write_text("no_rows\n", encoding="utf-8")
        return
    fields = sorted({k for r in rows for k in r.keys()})
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main() -> int:
    ap = argparse.ArgumentParser(description="ZIP契約書をtenpo soukoへ一括取り込み")
    ap.add_argument("--zip", required=True, help="契約書ZIPファイル")
    ap.add_argument("--base", default="https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod")
    ap.add_argument("--token-file", default=str(Path.home() / ".cognito_token"))
    ap.add_argument("--min-score", type=float, default=84.0)
    ap.add_argument("--report-dir", default="docs/spec")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    zip_file = Path(args.zip).expanduser().resolve()
    if not zip_file.exists():
        print(f"[ERR] ZIP not found: {zip_file}", file=sys.stderr)
        return 2

    token = ""
    tf = Path(args.token_file).expanduser()
    if tf.exists():
        token = tf.read_text(encoding="utf-8").strip()
    if not token:
        print("[ERR] token missing. set --token-file or ~/.cognito_token", file=sys.stderr)
        return 2

    rows = load_master(args.base, token)
    print(f"[INFO] tenpo={len(rows)} zip={zip_file.name} min_score={args.min_score}")
    plans, unmatched = build_plan(zip_file, rows, args.min_score)
    print(f"[SUMMARY] matched={len(plans)} unmatched={len(unmatched)}")

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    matched_csv = report_dir / f"souko_contracts_matched_{ts}.csv"
    unmatched_csv = report_dir / f"souko_contracts_unmatched_{ts}.csv"

    write_csv(
        matched_csv,
        [
            {
                "zip_path": p.zip_path,
                "file_name": p.file_name,
                "file_size": p.file_size,
                "tenpo_id": p.tenpo_id,
                "tenpo_name": p.tenpo_name,
                "torihikisaki_id": p.torihikisaki_id,
                "torihikisaki_name": p.torihikisaki_name,
                "score": round(p.score, 2),
                "strategy": p.strategy,
            }
            for p in plans
        ],
    )
    write_csv(unmatched_csv, unmatched)
    print(f"[REPORT] matched={matched_csv}")
    print(f"[REPORT] unmatched={unmatched_csv}")

    for p in plans[:20]:
        print(f"[PLAN] {p.file_name} -> {p.tenpo_id} {p.tenpo_name} score={p.score:.1f} via={p.strategy}")
    if len(plans) > 20:
        print(f"[PLAN] ... and {len(plans) - 20} more")

    if not args.apply:
        print("[DRY-RUN] no write. use --apply to upload and update souko.")
        return 0

    ok, ng = apply_plan(zip_file, plans, args.base, token)
    print(f"[APPLY] ok={ok} ng={ng}")
    return 0 if ng == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

