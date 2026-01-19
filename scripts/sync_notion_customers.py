import os
import json
import requests
from dotenv import load_dotenv

# Load credentials
NOTION_TOKEN = os.getenv("NOTION_API_KEY")
DATABASE_ID = os.getenv("NOTION_DATABASE_ID")

def fetch_all_notion_customers():
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    
    customers = []
    has_more = True
    next_cursor = None
    
    while has_more:
        payload = {"start_cursor": next_cursor} if next_cursor else {}
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            break
            
        data = response.json()
        for page in data.get("results", []):
            props = page.get("properties", {})
            
            # Extract data safely based on the Notion image columns
            def get_text(prop_name):
                prop = props.get(prop_name, {})
                if not prop: return ""
                ptype = prop.get("type")
                if ptype == "title":
                    return "".join([t.get("plain_text", "") for t in prop.get("title", [])])
                elif ptype == "rich_text":
                    return "".join([t.get("plain_text", "") for t in prop.get("rich_text", [])])
                elif ptype == "select":
                    return (prop.get("select") or {}).get("name", "")
                elif ptype == "multi_select":
                    return ", ".join([s.get("name") for s in prop.get("multi_select", [])])
                elif ptype == "phone_number":
                    return prop.get("phone_number") or ""
                elif ptype == "email":
                    return prop.get("email") or ""
                return ""

            customers.append({
                "company": get_text("会社名"),
                "brand": get_text("ブランド名"),
                "store": get_text("店舗名"),
                "status": get_text("ステータス"),
                "email": get_text("ログインメール"),
                "phone": get_text("電話番号"),
                "contact_person": get_text("担当者"),
                "frequency": get_text("清掃頻度"),
                "needs": get_text("ニーズ内容"),
                "items": get_text("実施項目"),
                "notion_id": page.get("id")
            })
            
        has_more = data.get("has_more")
        next_cursor = data.get("next_cursor")
        
    return customers

if __name__ == "__main__":
    # Test fetch
    print("Fetching data from Notion...")
    data = fetch_all_notion_customers()
    print(f"Successfully fetched {len(data)} customers.")
    
    # Save to local file for comparison
    with open("notion_export.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Data saved to notion_export.json")
