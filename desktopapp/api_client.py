"""
API Client for interacting with Firebase Cloud Functions HTTP Endpoints
"""
import requests
import datetime
from .config import API_BASE_URL

class CloudApiClient:
    def __init__(self, base_url=API_BASE_URL, timeout=10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def check_health(self):
        """Check if Cloud Functions are reachable"""
        try:
            r = requests.get(f"{self.base_url}/health", timeout=self.timeout)
            return r.status_code == 200, r.json() if r.status_code == 200 else {}
        except Exception as e:
            return False, {"error": str(e)}

    def verify_employee(self, emp_id_or_pin):
        """Verify employee by PIN / ID"""
        try:
            payload = {
                "empId": str(emp_id_or_pin).strip(),
                "pin": str(emp_id_or_pin).strip(),
                "id": str(emp_id_or_pin).strip()
            }
            r = requests.post(f"{self.base_url}/api/employees/verify", json=payload, timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200 and data.get("verified", False), data
        except Exception as e:
            return False, {"success": False, "verified": False, "message": str(e)}

    def get_employee(self, emp_id):
        """Fetch employee profile by ID"""
        try:
            r = requests.get(f"{self.base_url}/api/employees/{emp_id}", timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200, data
        except Exception as e:
            return False, {"success": False, "message": str(e)}

    def place_meal_order(self, emp_id, emp_name, start_date, end_date, breakfast=0, lunch=0, dinner=0, department="Operations", pay_category="Factory Daily Paid"):
        """Place single or batch meal order"""
        try:
            clean_id = str(emp_id).strip()
            if not clean_id or clean_id in ["None", "null", "undefined"]:
                return False, {"success": False, "message": "Invalid employee ID"}

            payload = {
                "emp_id": clean_id,
                "employeeId": clean_id,
                "emp_name": emp_name or f"EMP-{clean_id}",
                "start_date": start_date,
                "end_date": end_date,
                "breakfast": int(breakfast),
                "lunch": int(lunch),
                "dinner": int(dinner),
                "department": department,
                "pay_category": pay_category,
                "createdBy": "Desktop Kiosk App"
            }
            r = requests.post(f"{self.base_url}/api/meals/order", json=payload, timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200 and data.get("success", False), data
        except Exception as e:
            return False, {"success": False, "message": str(e)}

    def dispense_meal(self, emp_id, meal_type=None, date=None, dispensed_by="Receiving Kiosk"):
        """Verify and dispense meal for employee"""
        try:
            clean_id = str(emp_id).strip()
            if not clean_id or clean_id in ["None", "null", "undefined"]:
                return False, {"success": False, "dispensed": False, "message": "Invalid employee PIN"}

            payload = {
                "employeeId": clean_id,
                "emp_id": clean_id,
                "mealType": meal_type,
                "date": date or datetime.date.today().isoformat(),
                "dispensedBy": dispensed_by
            }
            r = requests.post(f"{self.base_url}/api/meals/dispense", json=payload, timeout=self.timeout)
            data = r.json() if r.content else {}
            # Return ok=True if HTTP was successful or recognized 409 (already received)
            return r.status_code in [200, 404, 409], data
        except Exception as e:
            return False, {"success": False, "dispensed": False, "message": str(e)}

    def get_today_summary(self, date=None):
        """Fetch today's meal allocations summary"""
        try:
            target_date = date or datetime.date.today().isoformat()
            r = requests.get(f"{self.base_url}/api/meals/today?date={target_date}", timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200, data
        except Exception as e:
            return False, {"success": False, "message": str(e)}

    def get_employee_orders(self, emp_id, days=7, start_date=None):
        """Fetch active meal allocations for an employee for next N days"""
        try:
            clean_id = str(emp_id).strip()
            url = f"{self.base_url}/api/meals/employee/{clean_id}?days={days}"
            if start_date:
                url += f"&startDate={start_date}"
            r = requests.get(url, timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200, data
        except Exception as e:
            return False, {"success": False, "message": str(e)}

    def check_allocations(self, emp_id, start_date, end_date):
        """Check if employee already has allocations in a date range"""
        try:
            clean_id = str(emp_id).strip()
            payload = {
                "emp_id": clean_id,
                "start_date": start_date,
                "end_date": end_date
            }
            r = requests.post(f"{self.base_url}/api/meals/check-allocations", json=payload, timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200 and data.get("success", False), data
        except Exception as e:
            return False, {"success": False, "hasExisting": False, "message": str(e)}

    def clear_all_meals(self):
        """Clear all meal allocation records from Firestore"""
        try:
            r = requests.post(f"{self.base_url}/api/meals/clear-all", timeout=self.timeout)
            data = r.json() if r.content else {}
            return r.status_code == 200 and data.get("success", False), data
        except Exception as e:
            return False, {"success": False, "message": str(e)}

    def send_heartbeat(self, kiosk_id, kiosk_name, role, status="ONLINE"):
        """Send kiosk heartbeat beacon"""
        try:
            payload = {
                "kioskId": kiosk_id,
                "kioskName": kiosk_name,
                "role": role,
                "status": status
            }
            r = requests.post(f"{self.base_url}/api/kiosks/heartbeat", json=payload, timeout=4)
            return r.status_code == 200, r.json() if r.content else {}
        except Exception:
            return False, {}

