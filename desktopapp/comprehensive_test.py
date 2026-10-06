"""
Comprehensive test script for Firebase Cloud Functions endpoints
"""
import requests
import json
import datetime

BASE_URL = "https://api-iv2t7b42ta-uc.a.run.app"

def test_all():
    print(f"Testing Cloud Functions at: {BASE_URL}\n")

    # 1. Health check
    print("[1] GET /health")
    r = requests.get(f"{BASE_URL}/health")
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 2. Root catalog
    print("[2] GET /")
    r = requests.get(f"{BASE_URL}/")
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 3. Create/Seed a Test Employee
    print("[3] POST /api/employees (Register Test Employee 9999)")
    emp_payload = {
        "emp_id": "9999",
        "first_name": "Test",
        "last_name": "User",
        "department": "Production",
        "pay_category": "Factory Daily Paid",
        "meal_preference": "Standard"
    }
    r = requests.post(f"{BASE_URL}/api/employees", json=emp_payload)
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 4. Verify Employee
    print("[4] POST /api/employees/verify (Verify PIN 9999)")
    verify_payload = {"empId": "9999", "pin": "9999"}
    r = requests.post(f"{BASE_URL}/api/employees/verify", json=verify_payload)
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 5. Place Meal Order
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    print(f"[5] POST /api/meals/order (Place Lunch Order for {today_str})")
    order_payload = {
        "emp_id": "9999",
        "emp_name": "Test User",
        "start_date": today_str,
        "end_date": today_str,
        "breakfast": 0,
        "lunch": 1,
        "dinner": 0,
        "department": "Production",
        "pay_category": "Factory Daily Paid"
    }
    r = requests.post(f"{BASE_URL}/api/meals/order", json=order_payload)
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 6. Today's Summary
    print(f"[6] GET /api/meals/today?date={today_str}")
    r = requests.get(f"{BASE_URL}/api/meals/today?date={today_str}")
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 7. Dispense Meal
    print(f"[7] POST /api/meals/dispense (Dispense Lunch for 9999)")
    dispense_payload = {
        "employeeId": "9999",
        "mealType": "Lunch",
        "date": today_str,
        "dispensedBy": "Test Runner"
    }
    r = requests.post(f"{BASE_URL}/api/meals/dispense", json=dispense_payload)
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 8. Duplicate Dispense Test
    print(f"[8] POST /api/meals/dispense (Duplicate Dispense Attempt for 9999)")
    r = requests.post(f"{BASE_URL}/api/meals/dispense", json=dispense_payload)
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 9. ZKTeco ADMS Handshake
    print("[9] GET /iclock/cdata?SN=TESTMB360")
    r = requests.get(f"{BASE_URL}/iclock/cdata?SN=TESTMB360")
    print(f"Status: {r.status_code}, Body:\n{r.text}\n")

    # 10. ZKTeco ADMS Punch Post
    print("[10] POST /iclock/cdata?SN=TESTMB360&table=ATTLOG")
    attlog_line = f"9999\t{today_str} 12:30:00\t1\t1\n"
    r = requests.post(f"{BASE_URL}/iclock/cdata?SN=TESTMB360&table=ATTLOG", data=attlog_line, headers={"Content-Type": "text/plain"})
    print(f"Status: {r.status_code}, Body: {r.text}\n")

    # 11. Kiosk Heartbeat
    print("[11] POST /api/kiosks/heartbeat")
    hb_payload = {
        "kioskId": "test-ordering-kiosk",
        "kioskName": "Test Ordering Kiosk",
        "role": "ORDERING_KIOSK",
        "status": "ONLINE"
    }
    r = requests.post(f"{BASE_URL}/api/kiosks/heartbeat", json=hb_payload)
    print(f"Status: {r.status_code}, Body: {r.text}\n")

if __name__ == "__main__":
    test_all()
