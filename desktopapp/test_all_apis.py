import requests
import time
import datetime

BASE_URL = "https://us-central1-meal-management-project.cloudfunctions.net/api"
print(f"Testing API against {BASE_URL}")

s = requests.Session()
s.headers.update({"User-Agent": "Hayleys-Desktop-Kiosk/2.0", "Content-Type": "application/json"})

def time_request(method, url, **kwargs):
    t0 = time.time()
    try:
        r = s.request(method, url, timeout=8, **kwargs)
        el = round(time.time() - t0, 3)
        return r.status_code, el, r.json() if r.content else {}
    except Exception as e:
        el = round(time.time() - t0, 3)
        return None, el, str(e)

# 1. Health
print("\n1. Health Check:")
st, el, data = time_request("GET", f"{BASE_URL}/health")
print(f"   Status: {st}, Time: {el}s, Data: {data}")

# 2. Get Employee 641
print("\n2. Get Employee 641:")
st, el, data = time_request("GET", f"{BASE_URL}/api/employees/641")
print(f"   Status: {st}, Time: {el}s, Data: {data.get('data') if isinstance(data, dict) else data}")

# 3. Verify Employee 641
print("\n3. Verify Employee 641 (POST):")
st, el, data = time_request("POST", f"{BASE_URL}/api/employees/verify", json={"empId": "641"})
print(f"   Status: {st}, Time: {el}s, Data: {data}")

# 4. Check Allocations
today = datetime.date.today().isoformat()
print(f"\n4. Check Allocations for 641 ({today}):")
st, el, data = time_request("POST", f"{BASE_URL}/api/meals/check-allocations", json={"emp_id": "641", "start_date": today, "end_date": today})
print(f"   Status: {st}, Time: {el}s, Data: {data}")

# 5. Get Employee Orders (7 days)
print(f"\n5. Get Employee Orders 641 (7 days):")
st, el, data = time_request("GET", f"{BASE_URL}/api/meals/employee/641?days=7")
print(f"   Status: {st}, Time: {el}s, Count: {len(data.get('data', [])) if isinstance(data, dict) else data}")

# 6. Today Summary
print(f"\n6. Today Summary:")
st, el, data = time_request("GET", f"{BASE_URL}/api/meals/today?date={today}")
print(f"   Status: {st}, Time: {el}s, Data: {data.get('summary') if isinstance(data, dict) else data}")

# 7. Place Meal Order
future_date = (datetime.date.today() + datetime.timedelta(days=4)).isoformat()
print(f"\n7. Place Meal Order for {future_date}:")
order_payload = {
    "emp_id": "641",
    "emp_name": "Sanjey Asirvatham",
    "start_date": future_date,
    "end_date": future_date,
    "breakfast": 1,
    "lunch": 1,
    "dinner": 0,
    "department": "IT Operations",
    "pay_category": "Staff",
    "createdBy": "Test Suite"
}
st, el, data = time_request("POST", f"{BASE_URL}/api/meals/order", json=order_payload)
print(f"   Status: {st}, Time: {el}s, Data: {data}")

# 8. Dispense Meal
print(f"\n8. Dispense Meal for {future_date}:")
disp_payload = {
    "employeeId": "641",
    "mealType": "Lunch",
    "date": future_date,
    "dispensedBy": "Test Suite"
}
st, el, data = time_request("POST", f"{BASE_URL}/api/meals/dispense", json=disp_payload)
print(f"   Status: {st}, Time: {el}s, Data: {data}")

print("\n=== ALL ENDPOINT CHECKS COMPLETE ===")
