"""
Hayleys Meal Management System - Receiving & Dispensing Kiosk Application
Written in Python with CustomTkinter GUI & Embedded ZKTeco MB360 ADMS Middleware
Supports Interactive Ordered Meal Selection, Timeslot Serving Window Enforcement & Instant Dispense
"""
import sys
import os
import time
import datetime
import threading
import queue
import customtkinter as ctk

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from desktopapp.config import (
    API_BASE_URL,
    MIDDLEWARE_PORT,
    COLORS,
    FONT_FAMILY,
    RECEIVING_BANNER_SEC,
)
from desktopapp.api_client import CloudApiClient
from desktopapp.middleware import BiometricMiddlewareServer, get_local_ip_addresses
from desktopapp.sound_utils import play_success_beep, play_error_beep, play_warning_beep
import urllib.request

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("green")


# Serving Window Helper (Breakfast: 6-9 AM, Lunch: 11 AM - 2 PM, Dinner: 4-9:30 PM)
def check_meal_timeslot(meal_type, override=False):
    if override:
        return True, "Override Mode (Anytime)"
    now = datetime.datetime.now()
    total_mins = now.hour * 60 + now.minute

    if meal_type == "Breakfast":
        valid = 360 <= total_mins <= 540  # 06:00 - 09:00
        return valid, "06:00 AM - 09:00 AM"
    elif meal_type == "Lunch":
        valid = 660 <= total_mins <= 840  # 11:00 - 14:00
        return valid, "11:00 AM - 02:00 PM"
    elif meal_type == "Dinner":
        valid = 960 <= total_mins <= 1290  # 16:00 - 21:30
        return valid, "04:00 PM - 09:30 PM"
    return False, "Closed"


def get_current_time_slot():
    now = datetime.datetime.now()
    total_mins = now.hour * 60 + now.minute
    if 360 <= total_mins <= 540:
        return "Breakfast"
    elif 660 <= total_mins <= 840:
        return "Lunch"
    elif 960 <= total_mins <= 1290:
        return "Dinner"
    elif total_mins < 660:
        return "Breakfast"
    elif total_mins < 960:
        return "Lunch"
    else:
        return "Dinner"


class ReceivingKioskApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Hayleys Eco Solutions - Receiving Kiosk")
        self.geometry("1180x800")
        self.minsize(1050, 700)
        self.configure(fg_color=COLORS["bg_dark"])

        # Cloud API & Event Queue
        self.api = CloudApiClient(API_BASE_URL)
        self.event_queue = queue.Queue()
        self.log_history = []

        # State Management
        self.current_employee = None
        self.today_allocations = []
        self.selected_meal_type = None
        self.admin_override = False
        self.countdown_remaining = 25
        self.countdown_active = False

        # Stats
        self.today_total_orders = 0
        self.today_dispensed_count = 0

        # Local Host IP Addresses
        self.local_ips = get_local_ip_addresses()

        # Embedded Middleware Server on Port 4370
        self.middleware = BiometricMiddlewareServer(
            port=MIDDLEWARE_PORT,
            on_punch=self._on_biometric_punch_received,
            on_log=self._on_middleware_log,
        )
        self.middleware_running = self.middleware.start()

        # Seed initial log if empty
        if not self.log_history:
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            ip_str = ", ".join([f"{ip}:{self.middleware.port}" for ip in self.local_ips])
            self.log_history.append(f"[{now_str}] 🚀 [LISTENING] Receiving Kiosk Middleware active on Port {self.middleware.port}")
            self.log_history.append(f"[{now_str}] 🌐 Local Host Endpoint(s): {ip_str}")
            self.log_history.append(f"[{now_str}] ⏳ Waiting for incoming ZKTeco ADMS GET/POST packets on Port {self.middleware.port}...")

        # Build Main UI Frames
        self._build_header()
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.pack(fill="both", expand=True, padx=20, pady=(10, 16))

        # Show Initial Standby Screen
        self.show_standby_screen()

        # Start Background Event Poll & Live Clock
        self.after(100, self._process_events)
        self.after(1000, self._update_clock)
        self.after(1500, self._refresh_today_stats)
        self._send_initial_heartbeat()

    def _on_biometric_punch_received(self, pin, source_ip, protocol_type):
        """Triggered from background middleware thread"""
        self.event_queue.put(("PUNCH", pin, source_ip, protocol_type))

    def _on_middleware_log(self, log_msg):
        """Called asynchronously from middleware background thread"""
        self.event_queue.put(("LOG", log_msg))

    def _append_log(self, log_msg):
        """Append log message to in-memory history and active textbox if present"""
        self.log_history.append(log_msg)
        if len(self.log_history) > 300:
            self.log_history.pop(0)

        if hasattr(self, "log_textbox") and self.log_textbox.winfo_exists():
            try:
                self.log_textbox.configure(state="normal")
                self.log_textbox.insert("end", log_msg + "\n")
                self.log_textbox.see("end")
                self.log_textbox.configure(state="disabled")
            except Exception:
                pass

    def _process_events(self):
        """Process incoming events on main UI thread"""
        try:
            while not self.event_queue.empty():
                evt = self.event_queue.get_nowait()
                if evt[0] == "PUNCH":
                    pin = evt[1]
                    source_ip = evt[2] if len(evt) > 2 else "LAN"
                    proto = evt[3] if len(evt) > 3 else "ZKTECO_ADMS"
                    now_str = datetime.datetime.now().strftime("%H:%M:%S")
                    self._append_log(f"[{now_str}] 🍽️ [GUI EVENT] Dispense Scan for PIN: '{pin}' from {source_ip} via {proto}")
                    self._handle_employee_scan(pin)
                elif evt[0] == "LOG":
                    log_msg = evt[1]
                    self._append_log(log_msg)
        except Exception as e:
            print(f"[Receiving Event Error]: {e}")
        finally:
            self.after(100, self._process_events)

    def _send_initial_heartbeat(self):
        threading.Thread(
            target=lambda: self.api.send_heartbeat(
                "kiosk-receiving-desktop", "Receiving Kiosk Station", "RECEIVING_KIOSK"
            ),
            daemon=True,
        ).start()

    def _update_clock(self):
        now = datetime.datetime.now()
        time_str = now.strftime("%I:%M:%S %p")
        date_str = now.strftime("%A, %d %B %Y")
        if hasattr(self, "clock_label"):
            self.clock_label.configure(text=f"🕒 {time_str}  |  {date_str}")
        self.after(1000, self._update_clock)

    def _refresh_today_stats(self):
        def fetch_stats():
            ok, res = self.api.get_today_summary()
            if ok and res.get("success"):
                s = res.get("summary", {})
                self.today_total_orders = s.get("totalOrders", 0)
                self.today_dispensed_count = s.get("dispensedCount", 0)
                self.after(0, self._update_stats_ui)

        threading.Thread(target=fetch_stats, daemon=True).start()
        self.after(30000, self._refresh_today_stats)

    def _update_stats_ui(self):
        if hasattr(self, "stats_label") and self.stats_label.winfo_exists():
            self.stats_label.configure(
                text=f"Today's Dispensed: {self.today_dispensed_count} / {self.today_total_orders} Total Orders"
            )

    # -------------------------------------------------------------
    # HEADER UI
    # -------------------------------------------------------------
    def _build_header(self):
        header_frame = ctk.CTkFrame(
            self, fg_color=COLORS["card_bg"], corner_radius=12, height=68
        )
        header_frame.pack(fill="x", padx=20, pady=(14, 0))

        brand_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        brand_frame.pack(side="left", padx=18, pady=10)

        title = ctk.CTkLabel(
            brand_frame,
            text="HAYLEYS ECO SOLUTIONS",
            font=(FONT_FAMILY, 16, "bold"),
            text_color=COLORS["accent_teal"],
        )
        title.pack(anchor="w")

        subtitle = ctk.CTkLabel(
            brand_frame,
            text="Meal Dispensing & Verification Station  |  කෑම ලබාගැනීමේ කියෝස්කය",
            font=(FONT_FAMILY, 11),
            text_color=COLORS["text_muted"],
        )
        subtitle.pack(anchor="w")

        info_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        info_frame.pack(side="right", padx=18, pady=10)

        self.clock_label = ctk.CTkLabel(
            info_frame,
            text="🕒 --:--:--",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_main"],
        )
        self.clock_label.pack(anchor="e")

        status_text = (
            f"🟢 ZKTeco Port {self.middleware.port} Active"
            if self.middleware_running
            else "🔴 Middleware Offline"
        )
        status_label = ctk.CTkLabel(
            info_frame,
            text=status_text,
            font=(FONT_FAMILY, 10),
            text_color=COLORS["accent_teal"]
            if self.middleware_running
            else COLORS["accent_red"],
        )
        status_label.pack(anchor="e")

    # -------------------------------------------------------------
    # STANDBY SCREEN (Split 2-Panel: Scan/Collect & Port Listener Terminal)
    # -------------------------------------------------------------
    def show_standby_screen(self):
        self.current_employee = None
        self.today_allocations = []
        self.selected_meal_type = None
        self.countdown_active = False
        self.admin_override = False

        for widget in self.main_container.winfo_children():
            widget.destroy()

        standby_card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        standby_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.96, relheight=0.92)

        # 2-Column Split Grid
        col_grid = ctk.CTkFrame(standby_card, fg_color="transparent")
        col_grid.pack(fill="both", expand=True, padx=18, pady=16)
        col_grid.columnconfigure(0, weight=52)  # Left: Collect & PIN
        col_grid.columnconfigure(1, weight=48)  # Right: Live Port Listener Terminal
        col_grid.rowconfigure(0, weight=1)

        # =========================================================
        # LEFT PANEL: SCANNER & DISPENSE CONTROLS
        # =========================================================
        left_panel = ctk.CTkFrame(col_grid, fg_color=COLORS["input_bg"], corner_radius=16)
        left_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=0)

        icon_label = ctk.CTkLabel(
            left_panel, text="🍲", font=(FONT_FAMILY, 48)
        )
        icon_label.pack(pady=(16, 4))

        prompt_en = ctk.CTkLabel(
            left_panel,
            text="SCAN FINGERPRINT TO COLLECT MEAL",
            font=(FONT_FAMILY, 18, "bold"),
            text_color=COLORS["accent_teal"],
        )
        prompt_en.pack(pady=(0, 2))

        prompt_si = ctk.CTkLabel(
            left_panel,
            text="ආහාර ලබාගැනීමට ඔබගේ ඇඟිලි සලකුණ තබන්න",
            font=(FONT_FAMILY, 13),
            text_color=COLORS["text_main"],
        )
        prompt_si.pack(pady=(0, 8))

        # Serving Windows Guidelines Box
        timeslot_card = ctk.CTkFrame(
            left_panel, fg_color=COLORS["card_bg"], corner_radius=10
        )
        timeslot_card.pack(pady=(0, 10), padx=20, fill="x")

        ctk.CTkLabel(
            timeslot_card,
            text="🕒 CANTEEN SERVING HOURS (ආහාර ලබාදෙන වේලාවන්)",
            font=(FONT_FAMILY, 10, "bold"),
            text_color=COLORS["accent_green"],
        ).pack(pady=(6, 2))

        slots_text = (
            "☕ Breakfast: 06:00 AM - 09:00 AM  (උදෑසන)\n"
            "🍲 Lunch: 11:00 AM - 02:00 PM  (දවල්)\n"
            "🍽️ Dinner: 04:00 PM - 09:30 PM  (රාත්‍රී)"
        )
        ctk.CTkLabel(
            timeslot_card,
            text=slots_text,
            font=(FONT_FAMILY, 10),
            text_color=COLORS["text_muted"],
            justify="center",
        ).pack(pady=(0, 6))

        # Manual PIN Entry (Fallback)
        pin_box = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=12)
        pin_box.pack(fill="x", padx=20, pady=(0, 8), ipady=4)

        ctk.CTkLabel(
            pin_box,
            text="Or enter Employee ID manually:",
            font=(FONT_FAMILY, 10),
            text_color=COLORS["text_muted"],
        ).pack(anchor="w", padx=14, pady=(4, 2))

        entry_row = ctk.CTkFrame(pin_box, fg_color="transparent")
        entry_row.pack(fill="x", padx=14, pady=(0, 4))

        self.manual_entry = ctk.CTkEntry(
            entry_row,
            placeholder_text="Enter ID / PIN (e.g. 641)",
            font=(FONT_FAMILY, 13),
            height=36,
            justify="center",
        )
        self.manual_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.manual_entry.bind("<Return>", lambda e: self._manual_login())

        dispense_btn = ctk.CTkButton(
            entry_row,
            text="Identify ➔",
            font=(FONT_FAMILY, 12, "bold"),
            fg_color=COLORS["accent_teal"],
            hover_color=COLORS["accent_green"],
            width=90,
            height=36,
            command=self._manual_login,
        )
        dispense_btn.pack(side="right")

        # Diagnostics & Simulation Buttons
        test_frame = ctk.CTkFrame(left_panel, fg_color="transparent")
        test_frame.pack(fill="x", padx=20, pady=(0, 6))

        test_btns_row = ctk.CTkFrame(test_frame, fg_color="transparent")
        test_btns_row.pack(fill="x")

        test_punch_btn = ctk.CTkButton(
            test_btns_row,
            text="🧪 Simulate Scan (641)",
            font=(FONT_FAMILY, 10),
            height=28,
            fg_color=COLORS["card_border"],
            hover_color=COLORS["accent_teal"],
            command=lambda: self._simulate_punch("641"),
        )
        test_punch_btn.pack(side="left", fill="x", expand=True, padx=(0, 4))

        test_post_btn = ctk.CTkButton(
            test_btns_row,
            text="📡 Simulate ADMS POST",
            font=(FONT_FAMILY, 10),
            height=28,
            fg_color=COLORS["card_border"],
            hover_color=COLORS["accent_green"],
            command=lambda: self._simulate_http_post("641"),
        )
        test_post_btn.pack(side="right", fill="x", expand=True, padx=(4, 0))

        # Bottom Stats Bar
        self.stats_label = ctk.CTkLabel(
            left_panel,
            text=f"Today's Dispensed: {self.today_dispensed_count} / {self.today_total_orders} Total Orders",
            font=(FONT_FAMILY, 10, "bold"),
            text_color=COLORS["accent_teal"],
        )
        self.stats_label.pack(side="bottom", pady=8)

        # =========================================================
        # RIGHT PANEL: LIVE PORT LISTENER & TRAFFIC TERMINAL
        # =========================================================
        right_panel = ctk.CTkFrame(
            col_grid,
            fg_color=COLORS["card_bg"],
            corner_radius=16,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        right_panel.grid(row=0, column=1, sticky="nsew", padx=(10, 0), pady=0)

        # Terminal Header Bar
        term_header = ctk.CTkFrame(right_panel, fg_color="transparent")
        term_header.pack(fill="x", padx=16, pady=(14, 6))

        ctk.CTkLabel(
            term_header,
            text="📡 Live Biometric Port Listener",
            font=(FONT_FAMILY, 14, "bold"),
            text_color=COLORS["text_main"],
        ).pack(side="left")

        listener_badge = ctk.CTkLabel(
            term_header,
            text=f"● LISTENING : {self.middleware.port}",
            font=(FONT_FAMILY, 10, "bold"),
            text_color="#10b981" if self.middleware_running else "#ef4444",
            fg_color="#064e3b" if self.middleware_running else "#450a0a",
            corner_radius=6,
            padx=8,
            pady=3,
        )
        listener_badge.pack(side="right")

        # Network Info Strip
        info_strip = ctk.CTkFrame(right_panel, fg_color=COLORS["input_bg"], corner_radius=8)
        info_strip.pack(fill="x", padx=16, pady=(0, 8), ipady=4)

        primary_ip = self.local_ips[0] if self.local_ips else "127.0.0.1"
        all_ips_str = ", ".join([f"{ip}:{self.middleware.port}" for ip in self.local_ips])

        ctk.CTkLabel(
            info_strip,
            text=f"🌐 Server IP: {all_ips_str}\n🎯 ZKTeco ADMS URL: http://{primary_ip}:{self.middleware.port}/iclock/cdata",
            font=(FONT_FAMILY, 10),
            text_color=COLORS["text_muted"],
            justify="left",
        ).pack(anchor="w", padx=10, pady=2)

        # Terminal Console Box (CTkTextbox)
        self.log_textbox = ctk.CTkTextbox(
            right_panel,
            font=("Consolas", 10),
            fg_color="#080d14",
            text_color="#34d399",
            corner_radius=10,
            border_width=1,
            border_color="#1f293d",
            wrap="char",
        )
        self.log_textbox.pack(fill="both", expand=True, padx=16, pady=(0, 10))

        # Populate with existing log history
        self.log_textbox.configure(state="normal")
        for log_line in self.log_history:
            self.log_textbox.insert("end", log_line + "\n")
        self.log_textbox.see("end")
        self.log_textbox.configure(state="disabled")

        # Terminal Action Buttons
        term_actions = ctk.CTkFrame(right_panel, fg_color="transparent")
        term_actions.pack(fill="x", padx=16, pady=(0, 12))

        clear_btn = ctk.CTkButton(
            term_actions,
            text="🗑️ Clear Terminal",
            font=(FONT_FAMILY, 10),
            height=28,
            width=110,
            fg_color=COLORS["input_bg"],
            hover_color=COLORS["card_border"],
            command=self._clear_terminal_log,
        )
        clear_btn.pack(side="left")

        copy_btn = ctk.CTkButton(
            term_actions,
            text="📋 Copy ADMS URL",
            font=(FONT_FAMILY, 10),
            height=28,
            width=120,
            fg_color=COLORS["input_bg"],
            hover_color=COLORS["accent_teal"],
            command=lambda: self._copy_server_url(f"http://{primary_ip}:{self.middleware.port}/iclock/cdata"),
        )
        copy_btn.pack(side="right")

    def _clear_terminal_log(self):
        self.log_history.clear()
        if hasattr(self, "log_textbox") and self.log_textbox.winfo_exists():
            self.log_textbox.configure(state="normal")
            self.log_textbox.delete("1.0", "end")
            self.log_textbox.configure(state="disabled")
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self._append_log(f"[{now_str}] 🧹 Terminal log cleared. Listening on Port {self.middleware.port}...")

    def _copy_server_url(self, url):
        self.clipboard_clear()
        self.clipboard_append(url)
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self._append_log(f"[{now_str}] 📋 Copied ZKTeco ADMS Target URL to clipboard: {url}")

    def _simulate_punch(self, pin):
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self._append_log(f"[{now_str}] 🧪 [SIMULATION] Injecting biometric punch for PIN: '{pin}'")
        self.event_queue.put(("PUNCH", pin, "127.0.0.1 (Manual Test)", "SIMULATION"))

    def _simulate_http_post(self, pin):
        def post_task():
            try:
                now_str = datetime.datetime.now().strftime("%H:%M:%S")
                self._append_log(f"[{now_str}] 📡 [SIMULATION] Sending HTTP POST to http://127.0.0.1:{self.middleware.port}/iclock/cdata...")
                payload = f"{pin}\t{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\t1\t1\n".encode("utf-8")
                req = urllib.request.Request(
                    f"http://127.0.0.1:{self.middleware.port}/iclock/cdata?SN=TEST_DEV&table=ATTLOG",
                    data=payload,
                    headers={"Content-Type": "text/plain", "User-Agent": "ZKTeco iClock/Sim"}
                )
                with urllib.request.urlopen(req, timeout=3) as resp:
                    resp_body = resp.read().decode("utf-8")
                    self._append_log(f"[{now_str}] ✅ [SIMULATION] HTTP POST response: {resp_body.strip()}")
            except Exception as ex:
                now_str = datetime.datetime.now().strftime("%H:%M:%S")
                self._append_log(f"[{now_str}] ❌ [SIMULATION ERROR]: {ex}")

        threading.Thread(target=post_task, daemon=True).start()

    def _manual_login(self):
        pin = self.manual_entry.get().strip()
        if pin:
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            self._append_log(f"[{now_str}] ⌨️ [MANUAL INPUT] User submitted PIN: '{pin}'")
            self._handle_employee_scan(pin)

    # -------------------------------------------------------------
    # EMPLOYEE VERIFICATION & MEAL SELECTION SCREEN
    # -------------------------------------------------------------
    def _handle_employee_scan(self, pin):
        def load_task():
            # Step 1: Verify employee
            ok, res = self.api.verify_employee(pin)
            if not ok or not res.get("verified"):
                play_error_beep()
                return

            emp = res.get("employee", {})
            emp_id = str(emp.get("emp_id") or emp.get("employee_id") or emp.get("id") or pin).strip()
            emp["emp_id"] = emp_id
            emp["employee_id"] = emp_id

            # Step 2: Fetch today's allocations for employee
            today_str = datetime.date.today().strftime("%Y-%m-%d")
            ok_alloc, alloc_res = self.api.get_employee_orders(emp_id, days=1, start_date=today_str)
            allocs = alloc_res.get("data", []) if ok_alloc else []

            play_success_beep()
            self.after(0, lambda: self.show_meal_selection_screen(emp, allocs))

        threading.Thread(target=load_task, daemon=True).start()

    def show_meal_selection_screen(self, employee, today_allocations):
        self.current_employee = employee
        self.today_allocations = today_allocations or []
        self.selected_meal_type = None
        self.countdown_remaining = 25
        self.countdown_active = True

        for widget in self.main_container.winfo_children():
            widget.destroy()

        # Main Selection Container
        sel_card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        sel_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.92, relheight=0.9)

        # Top Bar: Employee Profile Info
        top_profile = ctk.CTkFrame(sel_card, fg_color=COLORS["input_bg"], corner_radius=12)
        top_profile.pack(fill="x", padx=20, pady=(16, 12), ipady=6)

        emp_id = str(employee.get("emp_id") or employee.get("employee_id") or "").strip()
        emp_name = (
            employee.get("name")
            or employee.get("full_name")
            or f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            or f"Employee {emp_id}"
        )
        emp_dept = employee.get("department") or employee.get("section") or employee.get("designation") or "Operations"
        emp_cat = employee.get("pay_category") or employee.get("category_employment") or "Staff"

        left_prof = ctk.CTkFrame(top_profile, fg_color="transparent")
        left_prof.pack(side="left", padx=16, pady=4)

        ctk.CTkLabel(
            left_prof,
            text=f"👤 {emp_name}  (ID: {emp_id})",
            font=(FONT_FAMILY, 15, "bold"),
            text_color=COLORS["text_main"],
        ).pack(anchor="w")

        ctk.CTkLabel(
            left_prof,
            text=f"Department: {emp_dept}  |  Category: {emp_cat}",
            font=(FONT_FAMILY, 11),
            text_color=COLORS["accent_teal"],
        ).pack(anchor="w")

        # Right status / override toggle
        right_prof = ctk.CTkFrame(top_profile, fg_color="transparent")
        right_prof.pack(side="right", padx=16, pady=4)

        self.logout_btn = ctk.CTkButton(
            right_prof,
            text=f"Cancel ({self.countdown_remaining}s)",
            font=(FONT_FAMILY, 11, "bold"),
            width=90,
            height=30,
            fg_color=COLORS["card_border"],
            hover_color=COLORS["accent_red"],
            command=self.show_standby_screen,
        )
        self.logout_btn.pack(side="right", padx=(8, 0))

        # Check if employee has admin override privilege (Only Emp ID 641)
        is_admin_user = emp_id in ["641", "admin", "ADMIN"]

        if is_admin_user:
            self.override_chk = ctk.CTkCheckBox(
                right_prof,
                text="Admin Override (Testing)",
                font=(FONT_FAMILY, 10),
                command=self._on_override_toggle,
            )
            self.override_chk.pack(side="right")
            if self.admin_override:
                self.override_chk.select()
        else:
            self.admin_override = False

        # Instruction Title
        ctk.CTkLabel(
            sel_card,
            text="Select Your Ordered Meal Portion (ලබාගැනීමට අවශ්‍ය ආහාරය තෝරන්න):",
            font=(FONT_FAMILY, 15, "bold"),
            text_color=COLORS["text_main"],
        ).pack(anchor="w", padx=24, pady=(4, 10))

        # 3 Meal Portion Cards Row
        cards_row = ctk.CTkFrame(sel_card, fg_color="transparent")
        cards_row.pack(fill="x", padx=20, pady=0)
        cards_row.columnconfigure(0, weight=1)
        cards_row.columnconfigure(1, weight=1)
        cards_row.columnconfigure(2, weight=1)

        meal_slots = [
            ("Breakfast", "උදෑසන • காலை", "☕", "#f59e0b", 0),
            ("Lunch", "දවල් • மதியம்", "🍲", "#10b981", 1),
            ("Dinner", "රාත්‍රී • இரவு", "🍽️", "#ef4444", 2),
        ]

        active_time_slot = get_current_time_slot()
        self.meal_card_frames = {}
        best_candidate = None

        for meal_key, sinhala_title, icon, accent_col, col_idx in meal_slots:
            # Check allocation state
            alloc = next((a for a in self.today_allocations if a.get("meal_type") == meal_key), None)
            is_ordered = alloc is not None
            is_received = is_ordered and (alloc.get("received") or (alloc.get("status") or "").lower() in ["received", "recieved"])
            is_valid_time, time_desc = check_meal_timeslot(meal_key, self.admin_override)
            is_ready = is_ordered and not is_received and is_valid_time

            # Priority 1: If current active time slot is ordered and ready, choose it
            if is_ready and meal_key == active_time_slot:
                best_candidate = meal_key
            # Priority 2: If no candidate yet and this meal is ready, choose it
            elif is_ready and best_candidate is None:
                best_candidate = meal_key
            # Priority 3: In override mode, any unreceived ordered meal
            elif is_ordered and not is_received and self.admin_override and best_candidate is None:
                best_candidate = meal_key

            card = ctk.CTkFrame(
                cards_row,
                fg_color=COLORS["input_bg"],
                corner_radius=16,
                border_width=2,
                border_color=COLORS["card_border"],
            )
            card.grid(row=0, column=col_idx, sticky="nsew", padx=8, pady=4, ipady=12)
            self.meal_card_frames[meal_key] = card

            # Make card clickable if ready or override
            if is_ready or (is_ordered and not is_received and self.admin_override):
                card.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

            # Card Header Icon & Title
            icon_lbl = ctk.CTkLabel(card, text=icon, font=(FONT_FAMILY, 38))
            icon_lbl.pack(pady=(12, 2))
            title_lbl = ctk.CTkLabel(
                card, text=meal_key, font=(FONT_FAMILY, 16, "bold"), text_color=accent_col
            )
            title_lbl.pack()
            sub_lbl = ctk.CTkLabel(
                card, text=sinhala_title, font=(FONT_FAMILY, 11), text_color=COLORS["text_muted"]
            )
            sub_lbl.pack(pady=(0, 8))

            # Window Tag
            time_tag_color = COLORS["accent_green"] if is_valid_time else COLORS["text_muted"]
            ctk.CTkLabel(
                card,
                text=f"Serving: {time_desc}",
                font=(FONT_FAMILY, 10, "bold"),
                text_color=time_tag_color,
            ).pack(pady=2)

            # Order Status Badge
            if is_received:
                status_text = "🍲 Already Received"
                status_color = "#34d399"
                status_bg = "#064e3b"
            elif is_ordered:
                if is_valid_time or self.admin_override:
                    status_text = "⚡ READY TO COLLECT"
                    status_color = "#10b981"
                    status_bg = "#022c22"
                else:
                    status_text = "🔒 Outside Serving Window"
                    status_color = "#fbbf24"
                    status_bg = "#422006"
            else:
                status_text = "⚪ Not Ordered Today"
                status_color = COLORS["text_muted"]
                status_bg = COLORS["card_bg"]

            status_badge = ctk.CTkLabel(
                card,
                text=status_text,
                font=(FONT_FAMILY, 11, "bold"),
                text_color=status_color,
                fg_color=status_bg,
                corner_radius=8,
                padx=10,
                pady=4,
            )
            status_badge.pack(pady=(8, 12))

            # Interactive Select Button
            if is_ready or (is_ordered and not is_received and self.admin_override):
                sel_btn = ctk.CTkButton(
                    card,
                    text="Select Meal  ➔",
                    font=(FONT_FAMILY, 12, "bold"),
                    fg_color=accent_col,
                    hover_color=COLORS["accent_teal"],
                    height=34,
                    command=lambda k=meal_key: self._select_meal_for_dispense(k),
                )
                sel_btn.pack(fill="x", padx=16, pady=(0, 6))
            elif is_ordered and not is_valid_time:
                ctk.CTkLabel(
                    card, text=f"Available at {time_desc.split('-')[0].strip()}", font=(FONT_FAMILY, 10), text_color=COLORS["text_muted"]
                ).pack(pady=(0, 6))

        # Bottom Action Bar: Confirm & Dispense Button
        action_bar = ctk.CTkFrame(sel_card, fg_color="transparent")
        action_bar.pack(fill="x", padx=20, pady=(16, 12))

        self.action_desc_label = ctk.CTkLabel(
            action_bar,
            text="Please select an eligible meal above to confirm collection.",
            font=(FONT_FAMILY, 12, "bold"),
            text_color=COLORS["text_muted"],
        )
        self.action_desc_label.pack(pady=(0, 8))

        self.confirm_btn = ctk.CTkButton(
            action_bar,
            text="CONFIRM & DISPENSE MEAL  |  ආහාරය ලබාගන්න",
            font=(FONT_FAMILY, 14, "bold"),
            height=48,
            fg_color=COLORS["accent_teal"],
            hover_color=COLORS["accent_green"],
            state="disabled",
            command=self._execute_dispense,
        )
        self.confirm_btn.pack(fill="x", padx=20)

        # Auto-select best eligible candidate if present
        if best_candidate:
            self._select_meal_for_dispense(best_candidate)

        # Run countdown
        self._run_countdown()

    def _on_override_toggle(self):
        emp = self.current_employee or {}
        emp_id = str(emp.get("emp_id") or emp.get("employee_id") or "").strip()
        if emp_id in ["641", "admin", "ADMIN"] and hasattr(self, "override_chk"):
            self.admin_override = bool(self.override_chk.get())
        else:
            self.admin_override = False
        if self.current_employee:
            self.show_meal_selection_screen(self.current_employee, self.today_allocations)

    def _select_meal_for_dispense(self, meal_key):
        self.countdown_remaining = 25
        self.selected_meal_type = meal_key

        # Highlight selected card border
        for k, card in self.meal_card_frames.items():
            if k == meal_key:
                card.configure(border_color=COLORS["accent_teal"], border_width=3, fg_color="#132338")
            else:
                card.configure(border_color=COLORS["card_border"], border_width=2, fg_color=COLORS["input_bg"])

        if hasattr(self, "confirm_btn"):
            self.confirm_btn.configure(
                text=f"CONFIRM & DISPENSE: {meal_key.upper()}  |  {meal_key} ලබාගන්න",
                state="normal",
                fg_color=COLORS["accent_teal"],
            )

        if hasattr(self, "action_desc_label"):
            self.action_desc_label.configure(
                text=f"✅ Selected: {meal_key} • Click below to dispense your meal portion.",
                text_color=COLORS["accent_green"],
            )

    # -------------------------------------------------------------
    # EXECUTE DISPENSATION
    # -------------------------------------------------------------
    def _execute_dispense(self):
        if not self.selected_meal_type or not self.current_employee:
            return

        meal_type = self.selected_meal_type
        emp = self.current_employee
        pin = str(emp.get("emp_id") or emp.get("employee_id") or "").strip()
        today_str = datetime.date.today().strftime("%Y-%m-%d")

        self.confirm_btn.configure(
            text="Dispensing & Updating Status...", state="disabled", fg_color=COLORS["card_border"]
        )

        def dispense_task():
            ok, res = self.api.dispense_meal(
                emp_id=pin,
                meal_type=meal_type,
                date=today_str,
                dispensed_by="Python Receiving Kiosk",
            )
            self.after(0, lambda: self._show_dispense_receipt(pin, meal_type, ok, res))

        threading.Thread(target=dispense_task, daemon=True).start()

    def _show_dispense_receipt(self, pin, meal_type, ok, res):
        for widget in self.main_container.winfo_children():
            widget.destroy()

        if ok and res.get("dispensed"):
            play_success_beep()
            alloc = res.get("allocation", {})
            emp_name = alloc.get("employee_name") or alloc.get("name") or f"EMP-{pin}"
            dept = alloc.get("department") or alloc.get("section") or alloc.get("designation") or "Operations"
            rec_at = alloc.get("received_at", datetime.datetime.now().strftime("%I:%M:%S %p"))

            card = ctk.CTkFrame(
                self.main_container,
                fg_color=COLORS["card_bg"],
                corner_radius=20,
                border_width=3,
                border_color=COLORS["accent_green"],
            )
            card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.85, relheight=0.8)

            ctk.CTkLabel(card, text="✅", font=(FONT_FAMILY, 68)).pack(pady=(25, 4))
            ctk.CTkLabel(
                card,
                text=f"{meal_type.upper()} DISPENSED SUCCESSFULLY!",
                font=(FONT_FAMILY, 22, "bold"),
                text_color=COLORS["accent_green"],
            ).pack(pady=(0, 4))
            ctk.CTkLabel(
                card,
                text="ආහාරය සාර්ථකව නිකුත් කරන ලදී. භුක්ති විඳින්න!",
                font=(FONT_FAMILY, 14),
                text_color=COLORS["text_main"],
            ).pack(pady=(0, 14))

            info_box = ctk.CTkFrame(card, fg_color=COLORS["input_bg"], corner_radius=12)
            info_box.pack(fill="x", padx=40, pady=10, ipady=8)

            ctk.CTkLabel(
                info_box, text=emp_name, font=(FONT_FAMILY, 18, "bold"), text_color=COLORS["text_main"]
            ).pack()
            ctk.CTkLabel(
                info_box,
                text=f"Employee ID: {pin}  |  Department: {dept}",
                font=(FONT_FAMILY, 12),
                text_color=COLORS["accent_teal"],
            ).pack(pady=3)
            ctk.CTkLabel(
                info_box,
                text=f"Meal Session: {meal_type}  |  Dispensed At: {rec_at}",
                font=(FONT_FAMILY, 11),
                text_color=COLORS["text_muted"],
            ).pack()

            self.today_dispensed_count += 1
            self._refresh_today_stats()

            # Done Button
            ctk.CTkButton(
                card,
                text="Done / Next Employee (ඊළඟ සේවකයා)",
                font=(FONT_FAMILY, 13, "bold"),
                fg_color=COLORS["accent_green"],
                hover_color=COLORS["accent_teal"],
                height=40,
                command=self.show_standby_screen,
            ).pack(pady=(16, 0))

            # Auto return to standby
            self.after(5000, self.show_standby_screen)

        elif res.get("alreadyReceived"):
            play_warning_beep()
            card = ctk.CTkFrame(
                self.main_container,
                fg_color=COLORS["card_bg"],
                corner_radius=20,
                border_width=3,
                border_color=COLORS["accent_yellow"],
            )
            card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.85, relheight=0.8)

            ctk.CTkLabel(card, text="⚠️", font=(FONT_FAMILY, 68)).pack(pady=(25, 4))
            ctk.CTkLabel(
                card,
                text="ALREADY COLLECTED TODAY!",
                font=(FONT_FAMILY, 22, "bold"),
                text_color=COLORS["accent_yellow"],
            ).pack(pady=(0, 4))
            ctk.CTkLabel(
                card,
                text="මෙම ආහාරය දැනටමත් ලබාගෙන ඇත",
                font=(FONT_FAMILY, 14),
                text_color=COLORS["text_main"],
            ).pack(pady=(0, 14))

            info_box = ctk.CTkFrame(card, fg_color=COLORS["input_bg"], corner_radius=12)
            info_box.pack(fill="x", padx=40, pady=10, ipady=8)

            ctk.CTkLabel(
                info_box, text=f"Employee ID: {pin}", font=(FONT_FAMILY, 16, "bold"), text_color=COLORS["text_main"]
            ).pack()
            ctk.CTkLabel(
                info_box,
                text=f"Your {meal_type} allocation was already recorded as received earlier.",
                font=(FONT_FAMILY, 12),
                text_color=COLORS["accent_yellow"],
            ).pack(pady=4)

            self.after(5000, self.show_standby_screen)

        else:
            play_error_beep()
            err_msg = res.get("message", "Unable to dispense meal.")
            card = ctk.CTkFrame(
                self.main_container,
                fg_color=COLORS["card_bg"],
                corner_radius=20,
                border_width=3,
                border_color=COLORS["accent_red"],
            )
            card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.85, relheight=0.8)

            ctk.CTkLabel(card, text="❌", font=(FONT_FAMILY, 68)).pack(pady=(25, 4))
            ctk.CTkLabel(
                card, text="DISPENSE FAILED", font=(FONT_FAMILY, 22, "bold"), text_color=COLORS["accent_red"]
            ).pack(pady=(0, 4))
            ctk.CTkLabel(
                card, text=err_msg, font=(FONT_FAMILY, 13), text_color=COLORS["text_muted"]
            ).pack(pady=10)

            self.after(5000, self.show_standby_screen)

    def _run_countdown(self):
        if not self.countdown_active:
            return
        if self.countdown_remaining <= 0:
            self.show_standby_screen()
            return

        self.countdown_remaining -= 1
        if hasattr(self, "logout_btn"):
            self.logout_btn.configure(
                text=f"Cancel ({self.countdown_remaining}s)"
            )
        self.after(1000, self._run_countdown)


def main():
    app = ReceivingKioskApp()
    app.mainloop()


if __name__ == "__main__":
    main()
