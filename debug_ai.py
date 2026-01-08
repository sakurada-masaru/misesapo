import requests
import json

API_URL = "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/ai/process"

def test_ai():
    payload = {
        "action": "assistant_concierge",
        "text": "こんにちは"
    }
    
    # Intentionally no auth header to see if it works (admin_concierge logic in python might not enforce it, 
    # or the initial check is missing in handle_ai_process.
    # If it fails with 401, I'll know. If it fails with 400 from Gemini, I'll see the message.
    
    try:
        print(f"Sending request to {API_URL}...")
        response = requests.post(API_URL, json=payload, headers={"Content-Type": "application/json"})
        
        print(f"Status Code: {response.status_code}")
        print("Response Body:")
        try:
            print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        except:
            print(response.text)
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_ai()
