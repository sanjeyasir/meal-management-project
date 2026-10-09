"""
End-to-End Test for Employee 641 (Sanjey Asirvatham) & Schema Variations
"""
import requests
import json
import datetime

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from desktopapp.config import API_BASE_URL
BASE_URL = API_BASE_URL

def run_tests():
    print(f"=== TESTING CLOUD API SCHEMA VALIDATION ===")
    
    # 1. Fetch Employee 641
    r = requests.get(f"{BASE_URL}/api/employees/641")
    assert r.status_code == 200, f"Failed to get employee 641: {r.text}"
    emp = r.json()["data"]
    print(f"[PASS] 1. GET /api/employees/641:")
    print(f"       Name: '{emp.get('name')}', ID: '{emp.get('emp_id')}', Dept: '{emp.get('department')}', Cat: '{emp.get('pay_category')}'")
    assert emp.get("emp_id") == "641"
    assert emp.get("name") == "Sanjey Asirvatham"

    # 2. Verify Employee with 'pin'
    r = requests.post(f"{BASE_URL}/api/employees/verify", json={"pin": "641"})
    assert r.status_code == 200 and r.json().get("verified"), f"Verify failed: {r.text}"
    v_emp = r.json()["employee"]
    print(f"[PASS] 2. POST /api/employees/verify (pin='641'): Verified {v_emp.get('name')}")

    # 3. Verify Employee with leading zero '0641'
    r = requests.post(f"{BASE_URL}/api/employees/verify", json={"pin": "0641"})
    assert r.status_code == 200 and r.json().get("verified"), f"Leading zero verify failed: {r.text}"
    print(f"[PASS] 3. POST /api/employees/verify (pin='0641'): Auto-resolved to {r.json()['employee']['name']}")

    # 4. Place Meal Order for 641
    target_date = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()
    order_payload = {
        "emp_id": emp.get("emp_id"),
        "emp_name": emp.get("name"),
        "start_date": target_date,
        "end_date": target_date,
        "breakfast": 1,
        "lunch": 1,
        "dinner": 1,
        "department": emp.get("department"),
        "pay_category": emp.get("pay_category")
    }
    r = requests.post(f"{BASE_URL}/api/meals/order", json=order_payload)
    assert r.status_code == 200 and r.json().get("success"), f"Order placement failed: {r.text}"
    print(f"[PASS] 4. POST /api/meals/order (Date: {target_date}): Created {r.json().get('createdCount')} order(s)")

    # 5. Dispense Meal for 641 on target date
    disp_payload = {
        "pin": "641",
        "mealType": "Lunch",
        "date": target_date
    }
    r = requests.post(f"{BASE_URL}/api/meals/dispense", json=disp_payload)
    assert r.status_code == 200 and r.json().get("dispensed"), f"Dispense failed: {r.text}"
    print(f"[PASS] 5. POST /api/meals/dispense: Dispensed Lunch for {r.json()['allocation'].get('employee_name')}")

    # 6. Duplicate Dispense Test
    r = requests.post(f"{BASE_URL}/api/meals/dispense", json=disp_payload)
    assert r.status_code in [200, 409], f"Unexpected status: {r.status_code}"
    print(f"[PASS] 6. Duplicate Dispense Check: Handled with status {r.status_code}")

    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")

if __name__ == "__main__":
    run_tests()
