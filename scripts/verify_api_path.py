import urllib.request
import urllib.error
import sys

# API Endpoints
REPORT_API_BASE = "https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod"

def verify_endpoints():
    endpoints = [
        # Correct endpoint
        f"{REPORT_API_BASE}/staff/reports", 
        # Incorrect endpoint
        f"{REPORT_API_BASE}/reports" 
    ]

    print("Verifying API Endpoints...")
    
    for url in endpoints:
        print(f"Checking: {url}")
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                print(f"Status Code: {response.getcode()}")
                print("Result: Accessible (200 OK)")
        except urllib.error.HTTPError as e:
            print(f"Status Code: {e.code}")
            # API Gateway behavior:
            # 403 Forbidden with {"message":"Missing Authentication Token"} -> Resource does not exist (or method not allowed on root)
            # 403 Forbidden with {"message":"User ... is not authorized ..."} -> Resource exists, Authorizer denied
            # 401 Unauthorized -> Resource exists, Auth header missing
            
            try:
                body = e.read().decode('utf-8')
            except:
                body = ""
                
            if e.code == 403 and "Missing Authentication Token" in body:
                print("Result: Path likely does NOT exist (403 Missing Authentication Token).")
            elif e.code in [401, 403]:
                print("Result: Path EXISTS (Auth error returned, meaning resource is reachable).")
            elif e.code == 404:
                print("Result: Path likely does NOT exist (404 Not Found).")
            else:
                print(f"Result: Unexpected status {e.code}")
                
        except Exception as e:
            print(f"Error checking {url}: {e}")
        print("---")

if __name__ == "__main__":
    verify_endpoints()
