#!/usr/bin/env python3
import argparse
import html
import io
import json
import os
import re
import sys
import unicodedata
import zipfile
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET


def nstr(v) -> str:
    return str(v or "").strip()


def norm_text(s: str) -> str:
    x = unicodedata.normalize("NFKC", s or "")
    x = x.replace("\r\n", "\n").replace("\r", "\n")
    x = re.sub(r"[ \t]+\n", "\n", x)
    x = re.sub(r"\n{3,}", "\n\n", x)
    x = x.replace("メール\nアドレス", "メールアドレス")
    x = x.replace("メール \nアドレス", "メールアドレス")
    return x.strip()


def jp_score(s: str) -> int:
    return sum(
        1
        for ch in s
        if ("\u3040" <= ch <= "\u30ff")
        or ("\u4e00" <= ch <= "\u9fff")
        or ("\uff66" <= ch <= "\uff9f")
    )


def decode_zip_name(info: zipfile.ZipInfo) -> str:
    name = info.filename
    if info.flag_bits & 0x800:
        return name
    try:
        raw = name.encode("cp437", errors="ignore")
    except Exception:
        return name
    cands = [name]
    for enc in ("cp932", "utf-8"):
        try:
            cands.append(raw.decode(enc))
        except Exception:
            pass
    cands = [c for c in cands if c]
    return sorted(cands, key=jp_score, reverse=True)[0]


def docx_to_text(docx_bytes: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"</w:p[^>]*>", "\n", xml)
    xml = re.sub(r"<w:br[^>]*/>", "\n", xml)
    xml = re.sub(r"<w:tab[^>]*/>", "\t", xml)
    xml = re.sub(r"<[^>]+>", "", xml)
    txt = html.unescape(xml)
    return norm_text(txt)


def docx_to_paragraphs(docx_bytes: bytes) -> List[str]:
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    root = ET.fromstring(xml)
    out: List[str] = []
    for p in root.findall(".//w:p", ns):
        txt = "".join((t.text or "") for t in p.findall(".//w:t", ns))
        txt = norm_text(txt)
        if txt:
            out.append(txt)
    # merge "メール" + "アドレス" split label
    merged: List[str] = []
    i = 0
    while i < len(out):
        cur = out[i]
        if cur == "メール" and i + 1 < len(out) and out[i + 1] == "アドレス":
            merged.append("メールアドレス")
            i += 2
            continue
        merged.append(cur)
        i += 1
    return merged


def section_between(text: str, start_pat: str, end_pats: List[str]) -> str:
    m = re.search(start_pat, text, flags=re.S)
    if not m:
        return ""
    start = m.end()
    end = len(text)
    for ep in end_pats:
        mm = re.search(ep, text[start:], flags=re.S)
        if mm:
            end = min(end, start + mm.start())
    return norm_text(text[start:end])


def jp_date_to_ymd(s: str) -> str:
    t = nstr(s)
    if not t:
        return ""
    m = re.search(r"(\d{4})[/-年](\d{1,2})[/-月](\d{1,2})", t)
    if not m:
        return ""
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{y:04d}-{mo:02d}-{d:02d}"


def clean_line(s: str) -> str:
    x = nstr(s)
    x = re.sub(r"^[・･\-\*]\s*", "", x)
    return x


def looks_address(s: str) -> bool:
    x = nstr(s)
    if not x:
        return False
    if "〒" in x:
        return True
    if re.search(r"\d{2,}-\d{2,}", x):
        return True
    if re.search(r"(都|道|府|県|市|区|町|村|丁目|番地|ビル|階|F|Ｂ|Ｂ１|B1)", x):
        return True
    return False


def normalize_key(s: str) -> str:
    x = unicodedata.normalize("NFKC", nstr(s)).lower()
    x = re.sub(r"[ 　\t\n\r\-ー―_・･,，、/／()\[\]{}「」『』:：.．〒]", "", x)
    return x


def find_marker_index(paras: List[str], patterns: List[str], start_idx: int = 0) -> int:
    for i in range(start_idx, len(paras)):
        p = paras[i]
        for pat in patterns:
            if pat in p:
                return i
    return -1


def parse_contract_text(text: str, title_hint: str, paragraphs: Optional[List[str]] = None) -> Dict[str, str]:
    paras = paragraphs or [x for x in norm_text(text).splitlines() if nstr(x)]
    title_ok = any(("利用者登録" in p and "申込書" in p) for p in paras[:10])
    if not title_ok:
        return {"_skip_reason": "not_contract_form"}

    marker_defs = [
        ("app_start", ["申込日及び利用開始日", "申込日および利用開始日"]),
        ("company_name", ["個人／法人名", "個人/法人名", "個人法人名"]),
        ("company_address", ["住所／本店住所", "住所/本店住所"]),
        ("contact_person", ["担当者"]),
        ("phone", ["電話番号"]),
        ("email", ["メールアドレス", "メール"]),
        ("store", ["サービスを利用したい店舗の名称及び住所"]),
        ("pricing", ["料金"]),
        ("cancel", ["個別業務のキャンセル"]),
        ("payment", ["支払方法"]),
        ("valid_term", ["有効期間"]),
        ("withdrawal", ["退会予告期間", "解約予告期間"]),
        ("special", ["特約事項"]),
        ("provider", ["サービス提供者"]),
    ]

    idx_map: Dict[str, int] = {}
    pats_map: Dict[str, List[str]] = {k: v for k, v in marker_defs}
    cursor = 0
    for key, pats in marker_defs:
        idx = find_marker_index(paras, pats, cursor)
        idx_map[key] = idx
        if idx >= 0:
            cursor = idx + 1

    def sec(key: str) -> str:
        i = idx_map.get(key, -1)
        if i < 0:
            return ""
        next_idxs = [v for k, v in idx_map.items() if v > i]
        j = min(next_idxs) if next_idxs else len(paras)
        block = paras[i + 1 : j]
        return norm_text("\n".join(block))

    def inline_after_marker(key: str) -> str:
        i = idx_map.get(key, -1)
        if i < 0:
            return ""
        line = paras[i]
        for pat in pats_map.get(key, []):
            if pat in line:
                rem = line.split(pat, 1)[1].strip()
                rem = re.sub(r"^[：:]\s*", "", rem)
                if rem:
                    return rem
        return ""

    app = sec("app_start")
    m = re.search(
        r"申込日[:：]\s*([0-9０-９]{4}[年/-][0-9０-９]{1,2}[月/-][0-9０-９]{1,2}日?)\s*[／/]\s*利用開始日[:：]\s*([0-9０-９]{4}[年/-][0-9０-９]{1,2}[月/-][0-9０-９]{1,2}日?)",
        app,
    )
    app_date = jp_date_to_ymd(m.group(1)) if m else ""
    start_date = jp_date_to_ymd(m.group(2)) if m else ""

    company_name = clean_line(sec("company_name").splitlines()[0] if sec("company_name") else "")
    if not company_name:
        company_name = clean_line(inline_after_marker("company_name"))
    company_name = re.sub(r"\s*[㊞印]\s*$", "", company_name).strip()
    company_name = re.sub(r"\s{2,}", " ", company_name).strip()
    if company_name in ("印", "㊞"):
        company_name = ""
    company_address = sec("company_address") or inline_after_marker("company_address")
    contact_person = clean_line(sec("contact_person").splitlines()[0] if sec("contact_person") else "")
    if not contact_person:
        contact_person = clean_line(inline_after_marker("contact_person"))
    phone = clean_line(sec("phone").splitlines()[0] if sec("phone") else "")
    if not phone:
        phone = clean_line(inline_after_marker("phone"))
    email = clean_line(sec("email").splitlines()[0] if sec("email") else "")
    if not email:
        email = clean_line(inline_after_marker("email"))
    if email in ("アドレス", "メール", "メールアドレス"):
        email = ""

    store_block = sec("store")
    store_lines = [clean_line(x) for x in store_block.splitlines() if nstr(x)]
    store_lines = [x for x in store_lines if "複数ある場合" not in x]
    store_non_addr = []
    for x in store_lines:
        pre = clean_line(x.split("〒")[0])
        pre = pre.strip("・･")
        if pre and not looks_address(pre):
            store_non_addr.append(pre)
    fallback_store = re.sub(r"_?ミセサポ.*$", "", os.path.splitext(os.path.basename(title_hint))[0]).strip()
    store_name = store_non_addr[0] if store_non_addr else fallback_store

    provider_block = sec("provider")
    provider_lines = [nstr(x) for x in provider_block.splitlines() if nstr(x)]
    provider_name = provider_lines[0] if provider_lines else ""
    provider_address = ""
    provider_phone = ""
    for ln in provider_lines[1:]:
        if "住所" in ln and not provider_address:
            provider_address = re.sub(r"^住所[:：]?\s*", "", ln).strip()
        elif "電話" in ln and not provider_phone:
            provider_phone = re.sub(r"^電話[:：]?\s*", "", ln).strip()

    return {
        "application_date": app_date,
        "start_date": start_date,
        "company_name": company_name,
        "company_address": company_address,
        "contact_person": contact_person,
        "phone": phone,
        "email": email,
        "store_name": store_name,
        "store_address": store_block,
        "pricing": sec("pricing"),
        "cancel_rule": sec("cancel"),
        "payment_method": sec("payment"),
        "valid_term": sec("valid_term"),
        "withdrawal_notice": sec("withdrawal"),
        "special_notes": sec("special"),
        "provider_name": provider_name,
        "provider_address": provider_address,
        "provider_phone": provider_phone,
        "_store_candidates": "\n".join([store_name] + store_non_addr + [fallback_store]),
    }


def read_token(token_file: str) -> str:
    with open(os.path.expanduser(token_file), "r", encoding="utf-8") as f:
        tok = f.read().strip().replace("\r", "").replace("\n", "")
    return tok[7:] if tok.startswith("Bearer ") else tok


def api_json(base: str, path: str, token: str, method: str = "GET", body: Optional[Dict] = None):
    url = f"{base.rstrip('/')}/{path.lstrip('/')}"
    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, method=method, headers=headers, data=data)
    with urlopen(req, timeout=40) as res:
        raw = res.read().decode("utf-8", errors="replace")
    return json.loads(raw or "{}")


def get_items(v) -> List[Dict]:
    if isinstance(v, list):
        return v
    if isinstance(v, dict) and isinstance(v.get("items"), list):
        return v["items"]
    return []


def find_best_tenpo(tenpo_rows: List[Dict], contract: Dict[str, str], file_name: str) -> Optional[Dict]:
    cand_texts = [
        contract.get("store_name", ""),
        contract.get("_store_candidates", ""),
        os.path.splitext(os.path.basename(file_name))[0],
    ]
    cand_keys = [normalize_key(x) for x in cand_texts if normalize_key(x)]
    if not cand_keys:
        return None
    best: Tuple[int, Optional[Dict]] = (0, None)
    for tp in tenpo_rows:
        tname = nstr(tp.get("name"))
        k = normalize_key(tname)
        if not k:
            continue
        score = 0
        for ck in cand_keys:
            if not ck:
                continue
            if ck == k:
                score = max(score, 100)
            elif ck in k or k in ck:
                score = max(score, 70)
            else:
                # partial character overlap
                common = len(set(ck) & set(k))
                score = max(score, min(40, common))
        if score > best[0]:
            best = (score, tp)
    return best[1] if best[0] >= 40 else None


def build_payload(contract: Dict[str, str], file_name: str, tenpo: Optional[Dict]) -> Dict[str, str]:
    tenpo_name = nstr((tenpo or {}).get("name"))
    contract_name_base = nstr(contract.get("store_name")) or nstr(contract.get("company_name")) or tenpo_name or "契約"
    out = {
        "name": f"{contract_name_base} 利用契約",
        "application_date": nstr(contract.get("application_date")),
        "start_date": nstr(contract.get("start_date")),
        "status": "active",
        "source": "contract_zip_import",
        "company_name": nstr(contract.get("company_name")),
        "company_address": nstr(contract.get("company_address")),
        "contact_person": nstr(contract.get("contact_person")),
        "phone": nstr(contract.get("phone")),
        "email": nstr(contract.get("email")),
        "store_name": nstr(contract.get("store_name")),
        "store_address": nstr(contract.get("store_address")),
        "pricing": nstr(contract.get("pricing")),
        "cancel_rule": nstr(contract.get("cancel_rule")),
        "payment_method": nstr(contract.get("payment_method")),
        "valid_term": nstr(contract.get("valid_term")),
        "withdrawal_notice": nstr(contract.get("withdrawal_notice")),
        "special_notes": nstr(contract.get("special_notes")),
        "provider_name": nstr(contract.get("provider_name")),
        "provider_address": nstr(contract.get("provider_address")),
        "provider_phone": nstr(contract.get("provider_phone")),
        "contract_doc_file_name": os.path.basename(file_name),
        "jotai": "yuko",
    }
    if tenpo:
        out["tenpo_id"] = nstr(tenpo.get("tenpo_id"))
        out["tenpo_name"] = tenpo_name
        out["yagou_id"] = nstr(tenpo.get("yagou_id"))
        out["yagou_name"] = nstr(tenpo.get("yagou_name"))
        out["torihikisaki_id"] = nstr(tenpo.get("torihikisaki_id"))
        out["torihikisaki_name"] = nstr(tenpo.get("torihikisaki_name"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Import keiyaku records from contract ZIP(docx)")
    ap.add_argument("--zip", required=True, help="Path to contract zip file")
    ap.add_argument("--base", default="http://127.0.0.1:3334/api-master/master", help="Master API base")
    ap.add_argument("--token-file", default="~/.cognito_token")
    ap.add_argument("--apply", action="store_true", help="POST/PUT to API")
    ap.add_argument("--out", default="/tmp/keiyaku_zip_parsed.json", help="Output parsed json")
    args = ap.parse_args()

    parsed = []
    with zipfile.ZipFile(args.zip) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = decode_zip_name(info)
            if not name.lower().endswith(".docx"):
                continue
            # skip temp lock files
            if "/~$" in name or os.path.basename(name).startswith("~$"):
                continue
            base_name = os.path.basename(name)
            # Skip templates/terms files that are not target contracts.
            if ("テンプレート" in base_name) or ("利用規約" in base_name and "申込書" not in base_name):
                parsed.append({"_file_name": name, "_skip_reason": "template_or_terms"})
                continue
            try:
                docx_bytes = zf.read(info)
                text = docx_to_text(docx_bytes)
                paras = docx_to_paragraphs(docx_bytes)
                contract = parse_contract_text(text, name, paras)
                contract["_file_name"] = name
                parsed.append(contract)
            except Exception as e:
                parsed.append({"_file_name": name, "_parse_error": str(e)})

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=2)
    print(f"[parse] docx={len(parsed)} out={args.out}")

    if not args.apply:
        print("[dry-run] parse only. use --apply to upsert keiyaku.")
        return 0

    token = read_token(args.token_file)
    tenpo_data = api_json(args.base, "tenpo?" + urlencode({"limit": 50000, "jotai": "yuko"}), token)
    tenpo_rows = get_items(tenpo_data)
    keiyaku_data = api_json(args.base, "keiyaku?" + urlencode({"limit": 5000, "jotai": "yuko"}), token)
    keiyaku_rows = get_items(keiyaku_data)

    by_file = {nstr(k.get("contract_doc_file_name")): k for k in keiyaku_rows if nstr(k.get("contract_doc_file_name"))}
    created = 0
    updated = 0
    skipped = 0

    for c in parsed:
        if c.get("_parse_error"):
            print(f"[skip] parse_error: {c.get('_file_name')} : {c.get('_parse_error')}")
            skipped += 1
            continue
        if c.get("_skip_reason"):
            print(f"[skip] {c.get('_skip_reason')}: {c.get('_file_name')}")
            skipped += 1
            continue
        file_name = c["_file_name"]
        tenpo = find_best_tenpo(tenpo_rows, c, file_name)
        payload = build_payload(c, file_name, tenpo)
        if not nstr(payload.get("tenpo_id")):
            print(f"[skip] tenpo_unmatched: {file_name}")
            skipped += 1
            continue

        existing = by_file.get(os.path.basename(file_name))
        try:
            if existing and nstr(existing.get("keiyaku_id")):
                kid = nstr(existing["keiyaku_id"])
                body = dict(existing)
                body.update(payload)
                body["keiyaku_id"] = kid
                api_json(args.base, f"keiyaku/{quote(kid, safe='')}", token, method="PUT", body=body)
                updated += 1
                print(f"[update] {kid} <- {file_name}")
            else:
                res = api_json(args.base, "keiyaku", token, method="POST", body=payload)
                kid = nstr(res.get("keiyaku_id"))
                if kid:
                    by_file[os.path.basename(file_name)] = {"keiyaku_id": kid}
                created += 1
                print(f"[create] {kid or '(no-id)'} <- {file_name}")
        except Exception as e:
            print(f"[error] {file_name} : {e}")
            skipped += 1

    print(f"[done] created={created} updated={updated} skipped={skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
