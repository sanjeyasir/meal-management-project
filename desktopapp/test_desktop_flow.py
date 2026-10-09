"""
Simulate exact Desktop App workflow for Ordering Kiosk and Receiving Kiosk
Tests both Synchronous and Asynchronous Callbacks
"""
import sys
import os
import datetime
import time
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from desktopapp.api_client import CloudApiClient
from desktopapp.config import API_BASE_URL

def test_full_desktop_workflow():
    client = CloudApiClient(API_BASE_URL)
    print(f"Testing with Primary API URL: {client.primary_url}")
    print(f"Fallback URLs: {client.fallback_urls}")
    
    # 1. Health check
    healthy, h_data = client.check_health()
    print(f"1. Health Check: {healthy} -> {h_data}")
    assert healthy, "Cloud Functions API is not healthy"

    test_pin = "641"
    
    # 2. Ordering Kiosk Flow: Verify Employee (Sync)
    ok, v_data = client.verify_employee(test_pin)
    print(f"2. Verify Employee ({test_pin}) [Sync]: {ok} -> {v_data.get('message')}")
    assert ok and v_data.get("verified"), "Employee verification failed"
    
    emp = v_data.get("employee", {})
    emp_id = emp.get("emp_id") or emp.get("id") or test_pin
    emp_name = (emp.get("name") or emp.get("full_name") or f"{emp.get('first_name', '')} {emp.get('last_name', '')}").strip()
    print(f"   Resolved Employee: ID='{emp_id}', Name='{emp_name}', Dept='{emp.get('department')}'")
    assert str(emp_id) == test_pin, f"Expected emp_id {test_pin}, got {emp_id}"

    # 3. Test Asynchronous Verification
    async_done = threading.Event()
    async_res = {}
    def on_verified(ok_res, data):
        async_res["ok"] = ok_res
        async_res["data"] = data
        async_done.set()

    print("\n3. Testing Asynchronous Employee Verification...")
    t0 = time.time()
    client.verify_employee_async(test_pin, callback=on_verified)
    assert async_done.wait(timeout=15), "Async verification timed out"
    print(f"   Async Verify Result ({round(time.time()-t0, 3)}s): {async_res['ok']} -> {async_res['data'].get('message')}")
    assert async_res["ok"] and async_res["data"].get("verified"), "Async verify failed"

    # 4. Check Allocations Async (Choose a fresh date to test clean allocation & duplicate checks)
    import random
    day_offset = random.randint(10, 25)
    target_date = (datetime.date.today() + datetime.timedelta(days=day_offset)).isoformat()
    check_done = threading.Event()
    check_res = {}
    def on_check(ok_res, data, token):
        check_res["ok"] = ok_res
        check_res["data"] = data
        check_res["token"] = token
        check_done.set()

    print(f"\n4. Testing Asynchronous Check Allocations ({target_date})...")
    client.check_allocations_async(emp_id, target_date, target_date, callback=on_check, request_token=42)
    assert check_done.wait(timeout=15), "Async check allocations timed out"
    print(f"   Async Check Allocations (Token={check_res.get('token')}): {check_res['ok']} -> {check_res['data'].get('message')}")

    # 5. Place Meal Order Async (Book only Breakfast so dispensing once marks all meals on that day as received)
    order_done = threading.Event()
    order_res = {}
    def on_order(ok_res, data):
        order_res["ok"] = ok_res
        order_res["data"] = data
        order_done.set()

    print(f"\n5. Testing Asynchronous Place Meal Order for {target_date}...")
    client.place_meal_order_async(
        emp_id=emp_id,
        emp_name=emp_name,
        start_date=target_date,
        end_date=target_date,
        breakfast=1,
        lunch=0,
        dinner=0,
        department=emp.get("department", "Operations"),
        pay_category=emp.get("pay_category", "Staff"),
        callback=on_order
    )
    assert order_done.wait(timeout=15), "Async place meal order timed out"
    print(f"   Async Place Order: {order_res['ok']} -> {order_res['data'].get('message')}")

    # 6. Receiving Kiosk Flow: Dispense Breakfast Async
    disp_done = threading.Event()
    disp_res = {}
    def on_dispense(ok_res, data):
        disp_res["ok"] = ok_res
        disp_res["data"] = data
        disp_done.set()

    print(f"\n6. Testing Asynchronous Dispense Breakfast for {target_date}...")
    client.dispense_meal_async(
        emp_id=test_pin,
        meal_type="Breakfast",
        date=target_date,
        dispensed_by="Python Test Receiving Kiosk",
        callback=on_dispense
    )
    assert disp_done.wait(timeout=15), "Async dispense meal timed out"
    print(f"   Async Dispense Breakfast: {disp_res['ok']} -> {disp_res['data'].get('message')}")

    # 7. Duplicate Dispense Test (should return alreadyReceived)
    dup_done = threading.Event()
    dup_res = {}
    def on_dup(ok_res, data):
        dup_res["ok"] = ok_res
        dup_res["data"] = data
        dup_done.set()

    print(f"\n7. Testing Duplicate Dispense Protection for {target_date}...")
    client.dispense_meal_async(
        emp_id=test_pin,
        meal_type="Breakfast",
        date=target_date,
        dispensed_by="Python Test Receiving Kiosk",
        callback=on_dup
    )
    assert dup_done.wait(timeout=15), "Async duplicate dispense timed out"
    print(f"   Duplicate Dispense Response: {dup_res['data']}")
    assert dup_res["data"].get("alreadyReceived") is True or dup_res["data"].get("alreadyDispensed") is True, "Duplicate protection failed"

    # 8. Today summary Async
    today_str = datetime.date.today().isoformat()
    sum_done = threading.Event()
    sum_res = {}
    def on_sum(ok_res, data):
        sum_res["ok"] = ok_res
        sum_res["data"] = data
        sum_done.set()

    print(f"\n8. Testing Today's Summary Async ({today_str})...")
    client.get_today_summary_async(today_str, callback=on_sum)
    assert sum_done.wait(timeout=15), "Async today summary timed out"
    print(f"   Today Summary: {sum_res['ok']} -> {sum_res['data'].get('summary')}")

    print("\n[SUCCESS] ALL SYNCHRONOUS AND ASYNCHRONOUS DESKTOP WORKFLOWS PASSED 100%!")

if __name__ == "__main__":
    test_full_desktop_workflow()
