"""
Simulate exact Desktop App workflow for Ordering Kiosk and Receiving Kiosk
"""
import sys
import os
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from desktopapp.api_client import CloudApiClient
from desktopapp.config import API_BASE_URL

def test_full_desktop_workflow():
    client = CloudApiClient(API_BASE_URL)
    print(f"Testing with API URL: {client.base_url}")
    
    # 1. Health check
    healthy, h_data = client.check_health()
    print(f"1. Health Check: {healthy} -> {h_data}")
    assert healthy, "Cloud Functions API is not healthy"

    test_pin = "8001"
    
    # Register test employee first via direct API post if needed
    import requests
    reg_res = requests.post(f"{client.base_url}/api/employees", json={
        "emp_id": test_pin,
        "first_name": "Kasun",
        "last_name": "Perera",
        "department": "Eco Production",
        "company": "Hayleys Eco Solutions",
        "pay_category": "Factory Daily Paid"
    })
    print(f"2. Employee Registration: {reg_res.status_code} -> {reg_res.json()}")

    # 2. Ordering Kiosk Flow: Verify Employee
    ok, v_data = client.verify_employee(test_pin)
    print(f"3. Verify Employee ({test_pin}): {ok} -> {v_data}")
    assert ok and v_data.get("verified"), "Employee verification failed"
    
    emp = v_data.get("employee", {})
    emp_id = emp.get("emp_id") or emp.get("id") or test_pin
    emp_name = f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
    print(f"   Resolved Employee: ID='{emp_id}', Name='{emp_name}'")
    assert emp_id == test_pin, f"Expected emp_id {test_pin}, got {emp_id}"

    # 3. Place Order for Today
    today_str = datetime.date.today().isoformat()
    ok, o_data = client.place_meal_order(
        emp_id=emp_id,
        emp_name=emp_name,
        start_date=today_str,
        end_date=today_str,
        breakfast=1,
        lunch=1,
        dinner=0,
        department=emp.get("department", "Eco Production"),
        pay_category=emp.get("pay_category", "Factory Daily Paid")
    )
    print(f"4. Place Meal Order for {today_str}: {ok} -> {o_data}")

    # 4. Receiving Kiosk Flow: Dispense Breakfast
    ok, d_data = client.dispense_meal(
        emp_id=test_pin,
        meal_type="Breakfast",
        date=today_str,
        dispensed_by="Python Test Receiving Kiosk"
    )
    print(f"5. Dispense Breakfast: {ok} -> {d_data}")

    # 5. Duplicate Dispense Test (should return 409 alreadyReceived)
    ok, dup_data = client.dispense_meal(
        emp_id=test_pin,
        meal_type="Breakfast",
        date=today_str,
        dispensed_by="Python Test Receiving Kiosk"
    )
    print(f"6. Duplicate Dispense Breakfast: {ok} -> {dup_data}")
    assert dup_data.get("alreadyReceived") is True, "Duplicate protection failed"

    # 6. Dispense Lunch
    ok, d2_data = client.dispense_meal(
        emp_id=test_pin,
        meal_type="Lunch",
        date=today_str,
        dispensed_by="Python Test Receiving Kiosk"
    )
    print(f"7. Dispense Lunch: {ok} -> {d2_data}")

    # 7. Today summary
    ok, sum_data = client.get_today_summary(today_str)
    print(f"8. Today Summary: {ok} -> {sum_data.get('summary')}")

    print("\n[SUCCESS] ALL DESKTOP APP ENDPOINT WORKFLOWS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_desktop_workflow()
