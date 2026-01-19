import json

def normalize(text):
    if not text: return ""
    return str(text).strip().replace(" ", "").replace("　", "")

def compare_data():
    # Load Notion data
    try:
        with open("notion_export.json", "r", encoding="utf-8") as f:
            notion_data = json.load(f)
    except:
        # Fallback if I didn't save it to file yet (using the data from the browser result)
        # I'll manually paste the data from the last tool result here for the script to use
        # but better to save it properly first.
        return

    # Load AWS data
    try:
        with open("aws_export.json", "r", encoding="utf-8") as f:
            aws_raw = json.load(f)
            aws_data = aws_raw.get("items", [])
    except Exception as e:
        print(f"Error loading aws_export.json: {e}")
        return

    # Map AWS data by a key (name)
    aws_map = {}
    for item in aws_data:
        key = normalize(item.get("name", ""))
        if key:
            aws_map[key] = item

    results = {
        "new": [],
        "update": [],
        "removed": []
    }

    # Track which AWS records we've matched
    matched_aws_keys = set()

    for n in notion_data:
        n_store = n.get("store", "")
        n_brand = n.get("brand", "")
        
        # Try different possible name combinations for matching
        possible_keys = [
            normalize(n_store),
            normalize(n_brand + n_store),
            normalize(n_brand + " " + n_store),
            normalize(n_brand)
        ]
        
        match = None
        for pk in possible_keys:
            if pk and pk in aws_map:
                match = aws_map[pk]
                matched_aws_keys.add(pk)
                break
        
        if match:
            # Check status
            n_status = n.get("status", "")
            aws_status = match.get("status", "active")
            
            # Notion: 稼働中 -> active, その他 -> inactive or keep as is?
            # Let's be conservative
            is_notion_active = (n_status == "稼働中")
            is_aws_active = (aws_status == "active")
            
            if is_notion_active != is_aws_active:
                results["update"].append({
                    "name": match.get("name"),
                    "field": "status",
                    "old": aws_status,
                    "new": "active" if is_notion_active else "inactive",
                    "id": match.get("id")
                })
        else:
            results["new"].append(n)

    # AWS items not in Notion
    for key, item in aws_map.items():
        if key not in matched_aws_keys:
            # Only count as removed if it's currently active (to avoid listing old archived stuff)
            if item.get("status") == "active":
                results["removed"].append(item)

    # Print Report
    print(f"\n### 顧客データ比較レポート ###")
    print(f"\n1. 新規追加店舗 ({len(results['new'])}件):")
    for item in results["new"][:10]:
        print(f" - {item.get('company')} {item.get('brand')} {item.get('store')}")
    if len(results['new']) > 10: print("   ...他")

    print(f"\n2. 更新が必要な店舗 ({len(results['update'])}件):")
    for item in results["update"][:10]:
        print(f" - {item['name']}: {item['field']}を {item['old']} -> {item['new']} に更新")
    if len(results['update']) > 10: print("   ...他")

    print(f"\n3. AWSのみ存在（アーカイブ検討） ({len(results['removed'])}件):")
    for item in results["removed"][:10]:
        print(f" - {item.get('name')}")
    if len(results['removed']) > 10: print("   ...他")

if __name__ == "__main__":
    compare_data()
