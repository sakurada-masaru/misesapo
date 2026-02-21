#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Tuple


def read_token(path: str) -> str:
    if not path:
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            token = f.read().strip().replace("\r", "").replace("\n", "")
    except FileNotFoundError:
        return ""
    return token.removeprefix("Bearer ").strip()


def request_json(base: str, endpoint: str, token: str, method: str = "GET", body: Dict[str, Any] | None = None) -> Tuple[int, Dict[str, Any]]:
    url = f"{base.rstrip('/')}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url=url, method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            payload = res.read().decode("utf-8", errors="replace")
            return res.getcode(), json.loads(payload or "{}")
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(payload or "{}")
        except json.JSONDecodeError:
            parsed = {"raw": payload}
        return e.code, parsed


def includes_any(text: str, terms: List[str]) -> bool:
    return any(t in text for t in terms)


def classify_service(name: str, old_category: str) -> str:
    t = (name or "").lower()
    if includes_any(t, ["ゴキブリ", "チョウバエ", "ネズミ", "害虫", "害獣"]):
        return "pest_control"
    if includes_any(t, ["エアコン", "空調"]):
        return "aircon_cleaning"
    if includes_any(t, ["トイレ"]):
        return "restroom_cleaning"
    if includes_any(t, ["窓", "壁面", "ガラス"]):
        return "glass_wall_cleaning"
    if includes_any(t, ["床", "ワックス", "ポリッシャー", "スイーパー", "マット", "階段", "フローリング", "タイル", "カーペット"]):
        return "floor_cleaning"
    if includes_any(t, ["グリストラップ", "レンジフード", "ダクト", "換気扇", "シンク", "キッチン", "厨房", "テーブル"]):
        return "kitchen_cleaning"
    if includes_any(t, ["点検", "設備", "ファン", "配線", "メンテ", "巡回"]):
        return "facility_maintenance"
    if includes_any(t, ["補修", "修理", "工事"]):
        return "repair_construction"
    if includes_any(t, ["回収", "ゴミ", "不用品", "雑品"]):
        return "waste_collection"
    if includes_any(t, ["名義変更", "防火管理者", "食品衛生責任者", "アルコール類販売管理者"]):
        return "admin_procedure"
    if includes_any(t, ["研修", "交流会", "コンサル", "haccp対応", "食中毒検査", "workshop", "ワークショップ"]):
        return "training_consulting"
    if includes_any(t, ["web", "サイト", "印刷物", "名刺", "メニュー", "ブランディング"]):
        return "design_marketing"
    if includes_any(t, ["輸送", "郵送", "代行"]):
        return "logistics_support"
    if includes_any(t, ["人材派遣", "派遣"]):
        return "staffing_support"
    if old_category in {"maintenance"}:
        return "facility_maintenance"
    if old_category in {"pest", "pest_hygiene"}:
        return "pest_control"
    if old_category in {"aircon"}:
        return "aircon_cleaning"
    if old_category in {"floor"}:
        return "floor_cleaning"
    if old_category in {"window_wall"}:
        return "glass_wall_cleaning"
    if old_category in {"kitchen_haccp"}:
        return "hygiene_haccp"
    if old_category in {"cleaning"}:
        return "general_cleaning"
    if old_category in {"other"}:
        return "other_service"
    return "other_service"


def concept_for_category(category: str) -> str:
    mapping = {
        "general_cleaning": "cleaning",
        "kitchen_cleaning": "kitchen_haccp",
        "floor_cleaning": "floor",
        "aircon_cleaning": "aircon",
        "restroom_cleaning": "kitchen_haccp",
        "glass_wall_cleaning": "window_wall",
        "hygiene_haccp": "kitchen_haccp",
        "pest_control": "pest_hygiene",
        "facility_maintenance": "maintenance",
        "repair_construction": "maintenance",
        "waste_collection": "other",
        "admin_procedure": "other",
        "training_consulting": "other",
        "design_marketing": "other",
        "logistics_support": "other",
        "staffing_support": "other",
        "other_service": "other",
    }
    return mapping.get(category, "other")


def main() -> int:
    p = argparse.ArgumentParser(description="Reclassify service master categories")
    p.add_argument("--base", default=os.environ.get("MASTER_API_BASE", "http://127.0.0.1:3334/api-master"))
    p.add_argument("--token-file", default=os.path.expanduser("~/.cognito_token"))
    p.add_argument("--apply", action="store_true", help="apply updates to API")
    args = p.parse_args()

    token = read_token(args.token_file)
    status, payload = request_json(args.base, "/master/service?limit=5000&jotai=yuko", token, "GET")
    if status != 200:
        print(f"[NG] list failed status={status} payload={payload}")
        return 1

    items = payload if isinstance(payload, list) else (payload.get("items") or [])
    updates: List[Tuple[str, str, str, str, str]] = []
    for row in items:
        sid = str(row.get("service_id") or "").strip()
        if not sid:
            continue
        name = str(row.get("name") or "")
        old_cat = str(row.get("category") or "").strip()
        old_concept = str(row.get("category_concept") or "").strip()
        new_cat = classify_service(name, old_cat)
        new_concept = concept_for_category(new_cat)
        if old_cat != new_cat or old_concept != new_concept:
            updates.append((sid, name, old_cat, new_cat, new_concept))

    print(f"[INFO] services={len(items)} updates={len(updates)} apply={args.apply}")
    for sid, name, old_cat, new_cat, new_concept in updates:
        print(f"- {sid}: {name} | {old_cat or '-'} -> {new_cat} / concept={new_concept}")

    if not args.apply:
        print("[DRY-RUN] no write. use --apply to update DB")
        return 0

    ok = 0
    ng = 0
    for sid, _, _, new_cat, new_concept in updates:
        enc = urllib.parse.quote(sid, safe="")
        st, res = request_json(
            args.base,
            f"/master/service/{enc}",
            token,
            "PUT",
            {"category": new_cat, "category_concept": new_concept},
        )
        if st in (200, 201):
            ok += 1
        else:
            ng += 1
            print(f"[NG] update failed {sid} status={st} payload={res}")
    print(f"[DONE] updated_ok={ok} updated_ng={ng}")
    return 0 if ng == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
