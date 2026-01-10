import json
import requests
import time

API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod'
# Use a generic token if available, but for now I'll assume I can call it directly or user will provide it.
# Actually, I'll print the commands/calls it would make if I can't find a token.
# Wait, let me check if I can find a token in the environment or if I should ask.
# Usually I can't get Cognito tokens easily.
# But I can try to find a token in the local storage if I was running in a browser.
# Since I am a CLI agent, I might not have it.
# HOWEVER, the user asked me to "Update the database".

def normalize(text):
    if not text: return ""
    return str(text).strip().replace(" ", "").replace("　", "")

def sync():
    # Load files
    try:
        with open("notion_export.json", "r", encoding="utf-8") as f:
            notion_data = json.load(f)
        with open("aws_export.json", "r", encoding="utf-8") as f:
            aws_stores = json.load(f).get("items", [])
        with open("clients_export.json", "r", encoding="utf-8") as f:
            aws_clients = json.load(f).get("items", [])
        with open("brands_export.json", "r", encoding="utf-8") as f:
            aws_brands = json.load(f).get("items", [])
    except Exception as e:
        print(f"Error loading files: {e}")
        return

    # Maps for lookup
    client_map = {normalize(c.get("name")): c["id"] for c in aws_clients if c.get("name")}
    brand_map = {normalize(b.get("name")): b["id"] for b in aws_brands if b.get("name")}
    store_map = {normalize(s.get("name")): s for s in aws_stores if s.get("name")}

    # Helper to get/create client
    def get_or_create_client(name):
        key = normalize(name)
        if key in client_map:
            return client_map[key]
        print(f"Creating Client: {name}")
        # In a real script, we would POST to /clients
        # For now, I'll simulate or collect actions
        return None

    # Helper to get/create brand
    def get_or_create_brand(name, client_id):
        key = normalize(name)
        if key in brand_map:
            return brand_map[key]
        print(f"Creating Brand: {name}")
        return None

    actions = []

    for n in notion_data:
        n_company = n.get("company", "")
        n_brand = n.get("brand", "")
        n_store = n.get("store", "")
        n_status = n.get("status", "")
        n_email = n.get("email", "")
        n_phone = n.get("phone", "")
        n_contact = n.get("contact_person", "")

        # Target names for matching
        full_name = n_store if n_store else n_brand
        key = normalize(full_name)

        target_status = "active" if n_status == "稼働中" else "suspended"

        if key in store_map:
            aws_item = store_map[key]
            # Check for changes
            current_status = aws_item.get("status", "active")
            if current_status != target_status:
                actions.append({
                    "type": "UPDATE_STORE",
                    "id": aws_item["id"],
                    "name": full_name,
                    "data": {"status": target_status}
                })
        else:
            # New Store
            actions.append({
                "type": "CREATE_STORE",
                "name": full_name,
                "company": n_company,
                "brand": n_brand,
                "data": {
                    "name": full_name,
                    "status": target_status,
                    "email": n_email,
                    "phone": n_phone,
                    "contact_person": n_contact,
                    "company_name": n_company,
                    "brand_name": n_brand
                }
            })

    # Find removed
    matched_keys = {normalize(n.get("store") if n.get("store") else n.get("brand")) for n in notion_data}
    for key, s in store_map.items():
        if key not in matched_keys and s.get("status") == "active":
            actions.append({
                "type": "SUSPEND_STORE",
                "id": s["id"],
                "name": s["name"],
                "data": {"status": "suspended"}
            })

    print(f"Total Actions planned: {len(actions)}")
    for a in actions:
        print(f" - [{a['type']}] {a['name']} -> {a.get('data', {})}")

    # Note: I need an Auth Token to actually perform these.
    # Since I don't have one, I will ask the user or look for one.

if __name__ == "__main__":
    sync()
