import requests
import time

urls = [
    ("config API_BASE_URL", "https://api-u6eitt5vdq-uc.a.run.app"),
    ("test_641 BASE_URL", "https://api-iv2t7b42ta-uc.a.run.app"),
    ("Cloud Function v2 URL", "https://us-central1-meal-management-project.cloudfunctions.net/api"),
    ("Firebase Hosting /api", "https://meal-management-project.web.app/api"),
    ("Firebase App /api", "https://meal-management-project.firebaseapp.com/api"),
]

print("=== TESTING ENDPOINT CONNECTIVITY ===")
for name, base in urls:
    print(f"\n--- Testing: {name} ({base}) ---")
    
    # 1. Health check
    t0 = time.time()
    try:
        r = requests.get(f"{base}/health", timeout=4)
        elapsed = round(time.time() - t0, 3)
        print(f"  [GET /health] Status: {r.status_code}, Time: {elapsed}s, Body: {r.text[:100]}")
    except Exception as e:
        elapsed = round(time.time() - t0, 3)
        print(f"  [GET /health] FAILED ({elapsed}s): {type(e).__name__} - {e}")

    # 2. Get Employee 641
    t0 = time.time()
    try:
        r = requests.get(f"{base}/api/employees/641", timeout=4)
        elapsed = round(time.time() - t0, 3)
        print(f"  [GET /api/employees/641] Status: {r.status_code}, Time: {elapsed}s, Body: {r.text[:100]}")
    except Exception as e:
        elapsed = round(time.time() - t0, 3)
        print(f"  [GET /api/employees/641] FAILED ({elapsed}s): {type(e).__name__} - {e}")
