"""
Test script to verify Python API client integration with Firebase Cloud Functions
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from desktopapp.api_client import CloudApiClient

def test_integration():
    print("[1] Testing Cloud Functions Health...")
    client = CloudApiClient()
    ok, data = client.check_health()
    print(f"    Health Status: {ok} -> {data}")

    print("\n[2] Testing Today's Meal Allocations Summary...")
    ok, today_data = client.get_today_summary()
    print(f"    Today's Summary: {ok} -> {today_data.get('summary')}")

    print("\n[3] Testing Employee Verification for PIN '1001'...")
    ok, emp_data = client.verify_employee("1001")
    print(f"    Employee Verification: {ok} -> {emp_data.get('message')}")

if __name__ == "__main__":
    test_integration()
