"""
Hayleys Meal Management System - Ordering Kiosk Application
Written in Python with CustomTkinter GUI & Embedded ZKTeco MB360 ADMS Middleware
Supports Dynamic Date Range Scheduling, Live Meal Verification, and Existing Allocation Alerts
"""
import sys
import os
import time
import datetime
import threading
import queue
import customtkinter as ctk

# Add parent directory to sys.path for direct script execution
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from desktopapp.config import (
    API_BASE_URL,
    MIDDLEWARE_PORT,
    COLORS,
    FONT_FAMILY,
    ORDERING_TIMEOUT_SEC,
)
from desktopapp.api_client import CloudApiClient
from desktopapp.middleware import BiometricMiddlewareServer, get_local_ip_addresses
from desktopapp.sound_utils import play_success_beep, play_error_beep, play_warning_beep
import urllib.request

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("green")


class OrderingKioskApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Hayleys Eco Solutions - Ordering Kiosk")
        self.geometry("1180x800")
        self.minsize(1050, 700)
        self.configure(fg_color=COLORS["bg_dark"])

        # Cloud API & Event Queue
        self.api = CloudApiClient(API_BASE_URL)
        self.event_queue = queue.Queue()
        self.log_history = []

        # State Management
        self.current_employee = None
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        self.countdown_active = False

        # Meal Quantities
        self.breakfast_qty = 0
        self.lunch_qty = 1  # Default 1 lunch
        self.dinner_qty = 0

        # Date Range State (Defaults to Today -> Today)
        self.start_date = datetime.date.today()
        self.end_date = datetime.date.today()
        self.date_preset = "TODAY"

        # Existing allocations for the logged in user
        self.upcoming_allocations = []
        self.existing_in_range = []

        # Local Host IP Addresses
        self.local_ips = get_local_ip_addresses()

        # Embedded Middleware Server
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
            self.log_history.append(f"[{now_str}] 🚀 [LISTENING] Biometric Middleware active on Port {self.middleware.port}")
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
        self._send_initial_heartbeat()

    def _on_biometric_punch_received(self, pin, source_ip, protocol_type):
        """Called from middleware background thread upon POST capture"""
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
        """Process incoming events on the main Tkinter thread"""
        try:
            while not self.event_queue.empty():
                evt = self.event_queue.get_nowait()
                if evt[0] == "PUNCH":
                    pin = evt[1]
                    source_ip = evt[2] if len(evt) > 2 else "LAN"
                    proto = evt[3] if len(evt) > 3 else "ZKTECO_ADMS"
                    now_str = datetime.datetime.now().strftime("%H:%M:%S")
                    self._append_log(f"[{now_str}] 🎯 [GUI EVENT] Processing Punch PIN: '{pin}' from {source_ip} via {proto}")
                    self._handle_employee_login(pin)
                elif evt[0] == "LOG":
                    log_msg = evt[1]
                    self._append_log(log_msg)
        except Exception as e:
            print(f"[Event Process Error]: {e}")
        finally:
            self.after(100, self._process_events)

    def _send_initial_heartbeat(self):
        threading.Thread(
            target=lambda: self.api.send_heartbeat(
                "kiosk-ordering-desktop", "Ordering Kiosk Station", "ORDERING_KIOSK"
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

    # -------------------------------------------------------------
    # HEADER UI
    # -------------------------------------------------------------
    def _build_header(self):
        header_frame = ctk.CTkFrame(
            self, fg_color=COLORS["card_bg"], corner_radius=12, height=68
        )
        header_frame.pack(fill="x", padx=20, pady=(14, 0))

        # Brand Title
        brand_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        brand_frame.pack(side="left", padx=18, pady=10)

        title = ctk.CTkLabel(
            brand_frame,
            text="HAYLEYS ECO SOLUTIONS",
            font=(FONT_FAMILY, 16, "bold"),
            text_color=COLORS["accent_green"],
        )
        title.pack(anchor="w")

        subtitle = ctk.CTkLabel(
            brand_frame,
            text="Meal Ordering & Scheduling Kiosk  |  කෑම ඇණවුම් කියෝස්කය",
            font=(FONT_FAMILY, 11),
            text_color=COLORS["text_muted"],
        )
        subtitle.pack(anchor="w")

        # Clock & Status
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
            text_color=COLORS["accent_green"]
            if self.middleware_running
            else COLORS["accent_red"],
        )
        status_label.pack(anchor="e")

    # -------------------------------------------------------------
    # STANDBY SCREEN (Split 2-Panel: Login Scanner & Live Port Listener Terminal)
    # -------------------------------------------------------------
    def show_standby_screen(self):
        self.current_employee = None
        self.countdown_active = False
        self.upcoming_allocations = []
        self.existing_in_range = []

        # Clear container
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
        col_grid.columnconfigure(0, weight=52)  # Left: Biometric Scan & PIN
        col_grid.columnconfigure(1, weight=48)  # Right: Live Port Listener Terminal
        col_grid.rowconfigure(0, weight=1)

        # =========================================================
        # LEFT PANEL: SCANNER & LOGIN CONTROLS
        # =========================================================
        left_panel = ctk.CTkFrame(col_grid, fg_color=COLORS["input_bg"], corner_radius=16)
        left_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=0)

        # Scanner Icon
        icon_label = ctk.CTkLabel(
            left_panel, text="🖐️", font=(FONT_FAMILY, 56)
        )
        icon_label.pack(pady=(22, 6))

        # Main Prompts
        prompt_en = ctk.CTkLabel(
            left_panel,
            text="PLEASE SCAN YOUR FINGERPRINT",
            font=(FONT_FAMILY, 20, "bold"),
            text_color=COLORS["accent_green"],
        )
        prompt_en.pack(pady=(0, 2))

        prompt_si = ctk.CTkLabel(
            left_panel,
            text="කරුණාකර ඔබගේ ඇඟිලි සලකුණ තබන්න",
            font=(FONT_FAMILY, 14),
            text_color=COLORS["text_main"],
        )
        prompt_si.pack(pady=(0, 10))

        desc = ctk.CTkLabel(
            left_panel,
            text="Place your finger on the ZKTeco biometric device to authenticate.\nස්කෑනරය මගින් ඇඟිලි සලකුණ ස්කෑන් කර ඇණවුම් පිටුවට පිවිසෙන්න.",
            font=(FONT_FAMILY, 11),
            text_color=COLORS["text_muted"],
            justify="center",
        )
        desc.pack(pady=(0, 14), padx=16)

        # Manual PIN Entry
        pin_box = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=12)
        pin_box.pack(fill="x", padx=24, pady=(0, 12), ipady=6)

        ctk.CTkLabel(
            pin_box,
            text="Or enter Employee ID manually:",
            font=(FONT_FAMILY, 11),
            text_color=COLORS["text_muted"],
        ).pack(anchor="w", padx=16, pady=(6, 4))

        entry_row = ctk.CTkFrame(pin_box, fg_color="transparent")
        entry_row.pack(fill="x", padx=16, pady=(0, 6))

        self.pin_entry = ctk.CTkEntry(
            entry_row,
            placeholder_text="Enter PIN / ID (e.g. 641)",
            font=(FONT_FAMILY, 13),
            height=38,
            justify="center",
        )
        self.pin_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))
        self.pin_entry.bind("<Return>", lambda e: self._manual_login())

        login_btn = ctk.CTkButton(
            entry_row,
            text="Login ➔",
            font=(FONT_FAMILY, 12, "bold"),
            fg_color=COLORS["accent_green"],
            hover_color=COLORS["accent_teal"],
            width=95,
            height=38,
            command=self._manual_login,
        )
        login_btn.pack(side="right")

        # Diagnostics & Simulation Buttons
        test_frame = ctk.CTkFrame(left_panel, fg_color="transparent")
        test_frame.pack(fill="x", padx=24, pady=(0, 10))

        ctk.CTkLabel(
            test_frame,
            text="Quick Testing & Simulation:",
            font=(FONT_FAMILY, 10, "bold"),
            text_color=COLORS["text_muted"],
        ).pack(anchor="w", pady=(0, 4))

        test_btns_row = ctk.CTkFrame(test_frame, fg_color="transparent")
        test_btns_row.pack(fill="x")

        test_punch_btn = ctk.CTkButton(
            test_btns_row,
            text="🧪 Simulate Scan (641)",
            font=(FONT_FAMILY, 11),
            height=30,
            fg_color=COLORS["card_border"],
            hover_color=COLORS["accent_teal"],
            command=lambda: self._simulate_punch("641"),
        )
        test_punch_btn.pack(side="left", fill="x", expand=True, padx=(0, 4))

        test_post_btn = ctk.CTkButton(
            test_btns_row,
            text="📡 Simulate ADMS POST",
            font=(FONT_FAMILY, 11),
            height=30,
            fg_color=COLORS["card_border"],
            hover_color=COLORS["accent_green"],
            command=lambda: self._simulate_http_post("641"),
        )
        test_post_btn.pack(side="right", fill="x", expand=True, padx=(4, 0))

        # Status Message
        self.standby_status = ctk.CTkLabel(
            left_panel,
            text=f"🟢 Listening on Port {self.middleware.port} • Ready for device scan",
            font=(FONT_FAMILY, 11, "bold"),
            text_color=COLORS["accent_green"] if self.middleware_running else COLORS["accent_red"],
        )
        self.standby_status.pack(side="bottom", pady=14)

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
        pin = self.pin_entry.get().strip()
        if pin:
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            self._append_log(f"[{now_str}] ⌨️ [MANUAL INPUT] User submitted PIN: '{pin}'")
            self._handle_employee_login(pin)

    # -------------------------------------------------------------
    # EMPLOYEE VERIFICATION & LOGIN
    # -------------------------------------------------------------
    def _handle_employee_login(self, pin):
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self._append_log(f"[{now_str}] 🔍 Verifying Employee '{pin}' with Cloud Functions API...")
        if hasattr(self, "standby_status") and self.standby_status.winfo_exists():
            self.standby_status.configure(
                text=f"🔍 Verifying Employee {pin} with Cloud...",
                text_color=COLORS["accent_yellow"],
            )

        def verify_task():
            ok, res = self.api.verify_employee(pin)
            t_now = datetime.datetime.now().strftime("%H:%M:%S")
            if ok and res.get("verified"):
                emp = res.get("employee", {})
                emp_id = str(emp.get("emp_id") or emp.get("employee_id") or emp.get("id") or pin).strip()
                emp["emp_id"] = emp_id
                emp["employee_id"] = emp_id
                emp_name = (
                    emp.get("name")
                    or emp.get("full_name")
                    or f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                    or f"Employee {emp_id}"
                )

                self._append_log(f"[{t_now}] ✅ [AUTH SUCCESS] Employee Verified: {emp_name} (ID: {emp_id})")

                # Fetch upcoming allocations for user
                ok_alloc, alloc_res = self.api.get_employee_orders(emp_id, days=7)
                upcoming = alloc_res.get("data", []) if ok_alloc else []

                play_success_beep()
                self.after(0, lambda: self.show_ordering_screen(emp, upcoming))
            else:
                play_error_beep()
                msg = res.get("message", f"Employee {pin} not registered.")
                self._append_log(f"[{t_now}] ❌ [AUTH FAILED] Employee '{pin}': {msg}")
                self.after(0, lambda: self._show_login_error(msg))

        threading.Thread(target=verify_task, daemon=True).start()

    def _show_login_error(self, msg):
        if hasattr(self, "standby_status") and self.standby_status.winfo_exists():
            self.standby_status.configure(
                text=f"❌ {msg}", text_color=COLORS["accent_red"]
            )
            self.after(
                4000,
                lambda: self.standby_status.configure(
                    text=f"🟢 Listening on Port {self.middleware.port} • Ready for device scan",
                    text_color=COLORS["accent_green"],
                )
                if hasattr(self, "standby_status") and self.standby_status.winfo_exists()
                else None,
            )

    # -------------------------------------------------------------
    # ORDERING SCREEN (Full Date Range Story & Meal Allocation Check)
    # -------------------------------------------------------------
    def show_ordering_screen(self, employee, upcoming_allocations=None):
        self.current_employee = employee
        self.upcoming_allocations = upcoming_allocations or []
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        self.countdown_active = True

        # Default quantities
        self.breakfast_qty = 1
        self.lunch_qty = 1
        self.dinner_qty = 0

        # Reset date range to Today -> Today
        self.start_date = datetime.date.today()
        self.end_date = datetime.date.today()
        self.date_preset = "TODAY"

        for widget in self.main_container.winfo_children():
            widget.destroy()

        # Split 2-Column Layout: Left (Configuration & Meals) | Right (Profile & Allocations)
        grid_container = ctk.CTkFrame(self.main_container, fg_color="transparent")
        grid_container.pack(fill="both", expand=True)
        grid_container.columnconfigure(0, weight=65)  # Left column (Ordering Form)
        grid_container.columnconfigure(1, weight=35)  # Right column (Profile & Bookings)
        grid_container.rowconfigure(0, weight=1)

        # =========================================================
        # LEFT COLUMN: ORDERING FORM & MEAL SELECTION
        # =========================================================
        left_col = ctk.CTkFrame(
            grid_container,
            fg_color=COLORS["card_bg"],
            corner_radius=16,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        left_col.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=0)

        # 1. Section: Date Range Selector
        date_header = ctk.CTkFrame(left_col, fg_color="transparent")
        date_header.pack(fill="x", padx=18, pady=(16, 6))

        ctk.CTkLabel(
            date_header,
            text="1. Select Scheduling Date Range (දින පරාසය තෝරන්න)",
            font=(FONT_FAMILY, 15, "bold"),
            text_color=COLORS["text_main"],
        ).pack(anchor="w")

        # Preset Buttons
        preset_frame = ctk.CTkFrame(left_col, fg_color="transparent")
        preset_frame.pack(fill="x", padx=18, pady=(4, 10))

        presets = [
            ("Today", "TODAY"),
            ("Tomorrow", "TOMORROW"),
            ("Next 3 Days", "NEXT_3"),
            ("Next 7 Days", "NEXT_7"),
        ]
        self.preset_buttons = {}
        for title, key in presets:
            btn = ctk.CTkButton(
                preset_frame,
                text=title,
                font=(FONT_FAMILY, 11, "bold"),
                height=32,
                width=95,
                fg_color=COLORS["accent_green"] if key == "TODAY" else COLORS["input_bg"],
                hover_color=COLORS["accent_teal"],
                command=lambda k=key: self._apply_date_preset(k),
            )
            btn.pack(side="left", padx=(0, 8))
            self.preset_buttons[key] = btn

        # Date Pickers Row (From Date <-> To Date)
        picker_frame = ctk.CTkFrame(left_col, fg_color=COLORS["input_bg"], corner_radius=12)
        picker_frame.pack(fill="x", padx=18, pady=(0, 12), ipady=6)

        # From Date Box
        from_box = ctk.CTkFrame(picker_frame, fg_color="transparent")
        from_box.pack(side="left", padx=14, pady=4, expand=True)

        ctk.CTkLabel(
            from_box, text="📅 From Date:", font=(FONT_FAMILY, 11, "bold"), text_color=COLORS["text_muted"]
        ).pack(anchor="w")

        from_ctrl = ctk.CTkFrame(from_box, fg_color="transparent")
        from_ctrl.pack(anchor="w", pady=2)

        ctk.CTkButton(
            from_ctrl, text="◀", width=28, height=28, font=(FONT_FAMILY, 11),
            fg_color=COLORS["card_border"], command=lambda: self._adjust_date("START", -1)
        ).pack(side="left", padx=2)

        self.from_label = ctk.CTkLabel(
            from_ctrl, text=self.start_date.strftime("%Y-%m-%d"), font=(FONT_FAMILY, 13, "bold"), width=105
        )
        self.from_label.pack(side="left", padx=4)

        ctk.CTkButton(
            from_ctrl, text="▶", width=28, height=28, font=(FONT_FAMILY, 11),
            fg_color=COLORS["card_border"], command=lambda: self._adjust_date("START", 1)
        ).pack(side="left", padx=2)

        # Arrow Separator
        ctk.CTkLabel(picker_frame, text="➔", font=(FONT_FAMILY, 16, "bold"), text_color=COLORS["accent_teal"]).pack(side="left", padx=4)

        # To Date Box
        to_box = ctk.CTkFrame(picker_frame, fg_color="transparent")
        to_box.pack(side="left", padx=14, pady=4, expand=True)

        ctk.CTkLabel(
            to_box, text="📅 To Date:", font=(FONT_FAMILY, 11, "bold"), text_color=COLORS["text_muted"]
        ).pack(anchor="w")

        to_ctrl = ctk.CTkFrame(to_box, fg_color="transparent")
        to_ctrl.pack(anchor="w", pady=2)

        ctk.CTkButton(
            to_ctrl, text="◀", width=28, height=28, font=(FONT_FAMILY, 11),
            fg_color=COLORS["card_border"], command=lambda: self._adjust_date("END", -1)
        ).pack(side="left", padx=2)

        self.to_label = ctk.CTkLabel(
            to_ctrl, text=self.end_date.strftime("%Y-%m-%d"), font=(FONT_FAMILY, 13, "bold"), width=105
        )
        self.to_label.pack(side="left", padx=4)

        ctk.CTkButton(
            to_ctrl, text="▶", width=28, height=28, font=(FONT_FAMILY, 11),
            fg_color=COLORS["card_border"], command=lambda: self._adjust_date("END", 1)
        ).pack(side="left", padx=2)

        # Days Duration Tag
        self.duration_badge = ctk.CTkLabel(
            picker_frame,
            text="Duration: 1 Day",
            font=(FONT_FAMILY, 11, "bold"),
            text_color=COLORS["accent_green"],
            fg_color=COLORS["card_bg"],
            corner_radius=8,
            padx=10,
            pady=4,
        )
        self.duration_badge.pack(side="right", padx=14)

        # Existing Allocations Alert Banner for Selected Date Range
        self.alert_banner = ctk.CTkFrame(left_col, fg_color="transparent", corner_radius=10)
        self.alert_banner.pack(fill="x", padx=18, pady=(0, 10))
        self.alert_label = ctk.CTkLabel(
            self.alert_banner,
            text="",
            font=(FONT_FAMILY, 11, "bold"),
            wraplength=560,
            justify="left"
        )
        self.alert_label.pack(padx=10, pady=6, anchor="w")

        # 2. Section: Meal Portion Counters
        ctk.CTkLabel(
            left_col,
            text="2. Select Daily Meal Portions (ආහාර ප්‍රමාණය තෝරන්න)",
            font=(FONT_FAMILY, 15, "bold"),
            text_color=COLORS["text_main"],
        ).pack(anchor="w", padx=18, pady=(6, 8))

        meals_container = ctk.CTkFrame(left_col, fg_color="transparent")
        meals_container.pack(fill="x", padx=18, pady=0)

        # Breakfast Card
        self._build_meal_portion_card(
            meals_container,
            meal_name="Breakfast",
            sinhala_text="උදෑසන • காலை",
            icon="☕",
            accent_color="#f59e0b",
            attr_name="breakfast",
            initial_val=self.breakfast_qty,
        )

        # Lunch Card
        self._build_meal_portion_card(
            meals_container,
            meal_name="Lunch",
            sinhala_text="දවල් • மதியம்",
            icon="🍲",
            accent_color="#10b981",
            attr_name="lunch",
            initial_val=self.lunch_qty,
        )

        # Dinner Card
        self._build_meal_portion_card(
            meals_container,
            meal_name="Dinner",
            sinhala_text="රාත්‍රී • இரவு",
            icon="🍽️",
            accent_color="#ef4444",
            attr_name="dinner",
            initial_val=self.dinner_qty,
        )

        # 3. Section: Order Calculation & Submit Bar
        calc_bar = ctk.CTkFrame(left_col, fg_color=COLORS["input_bg"], corner_radius=12)
        calc_bar.pack(fill="x", padx=18, pady=(14, 12), ipady=6)

        self.summary_calc_label = ctk.CTkLabel(
            calc_bar,
            text="Calculating order summary...",
            font=(FONT_FAMILY, 12, "bold"),
            text_color=COLORS["text_main"],
        )
        self.summary_calc_label.pack(side="left", padx=14)

        self.submit_btn = ctk.CTkButton(
            left_col,
            text="CONFIRM & PLACE ORDER  |  ඇණවුම් කරන්න",
            font=(FONT_FAMILY, 14, "bold"),
            height=46,
            fg_color=COLORS["accent_green"],
            hover_color=COLORS["accent_teal"],
            command=self._submit_order,
        )
        self.submit_btn.pack(fill="x", padx=18, pady=(0, 16))

        # =========================================================
        # RIGHT COLUMN: EMPLOYEE PROFILE & UPCOMING 7-DAY ALLOCATIONS
        # =========================================================
        right_col = ctk.CTkFrame(
            grid_container,
            fg_color=COLORS["card_bg"],
            corner_radius=16,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        right_col.grid(row=0, column=1, sticky="nsew", padx=(10, 0), pady=0)

        # Profile Card
        profile_card = ctk.CTkFrame(right_col, fg_color=COLORS["input_bg"], corner_radius=12)
        profile_card.pack(fill="x", padx=14, pady=14, ipady=8)

        emp_id = str(employee.get("emp_id") or employee.get("employee_id") or employee.get("id") or "").strip()
        emp_name = (
            employee.get("name")
            or employee.get("full_name")
            or f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            or f"Employee {emp_id}"
        )
        emp_dept = employee.get("department") or employee.get("section") or employee.get("designation") or "Operations"
        emp_cat = employee.get("pay_category") or employee.get("category_employment") or "Staff"

        ctk.CTkLabel(profile_card, text="👤", font=(FONT_FAMILY, 36)).pack(pady=(4, 0))
        ctk.CTkLabel(
            profile_card, text=emp_name, font=(FONT_FAMILY, 15, "bold"), text_color=COLORS["text_main"]
        ).pack()
        ctk.CTkLabel(
            profile_card, text=f"ID: {emp_id}  |  {emp_dept}", font=(FONT_FAMILY, 11), text_color=COLORS["accent_green"]
        ).pack(pady=2)
        ctk.CTkLabel(
            profile_card, text=f"Category: {emp_cat}", font=(FONT_FAMILY, 10), text_color=COLORS["text_muted"]
        ).pack()

        # Upcoming Allocations Header
        alloc_header = ctk.CTkFrame(right_col, fg_color="transparent")
        alloc_header.pack(fill="x", padx=14, pady=(6, 4))
        ctk.CTkLabel(
            alloc_header, text="📋 Upcoming 7-Day Bookings", font=(FONT_FAMILY, 13, "bold"), text_color=COLORS["text_main"]
        ).pack(side="left")

        # Scrollable Allocations List
        self.alloc_scroll = ctk.CTkScrollableFrame(right_col, fg_color="transparent", height=320)
        self.alloc_scroll.pack(fill="both", expand=True, padx=14, pady=(0, 10))

        self._render_upcoming_allocations_list()

        # Logout / Inactivity Button
        self.logout_btn = ctk.CTkButton(
            right_col,
            text=f"Cancel / Exit ({self.countdown_remaining}s)",
            font=(FONT_FAMILY, 12, "bold"),
            fg_color=COLORS["input_bg"],
            hover_color=COLORS["accent_red"],
            height=36,
            command=self.show_standby_screen,
        )
        self.logout_btn.pack(fill="x", padx=14, pady=(0, 14))

        # Check existing allocations for the current date range
        self._check_existing_allocations_for_range()
        self._update_order_calculation()

        # Run countdown
        self._run_countdown()

    # -------------------------------------------------------------
    # DATE RANGE CONTROLS & PRESETS
    # -------------------------------------------------------------
    def _apply_date_preset(self, preset_key):
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        self.date_preset = preset_key
        today = datetime.date.today()

        if preset_key == "TODAY":
            self.start_date = today
            self.end_date = today
        elif preset_key == "TOMORROW":
            self.start_date = today + datetime.timedelta(days=1)
            self.end_date = today + datetime.timedelta(days=1)
        elif preset_key == "NEXT_3":
            self.start_date = today
            self.end_date = today + datetime.timedelta(days=2)
        elif preset_key == "NEXT_7":
            self.start_date = today
            self.end_date = today + datetime.timedelta(days=6)

        # Update button highlights
        for k, btn in self.preset_buttons.items():
            btn.configure(fg_color=COLORS["accent_green"] if k == preset_key else COLORS["input_bg"])

        self._refresh_date_display()

    def _adjust_date(self, which, delta_days):
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        today = datetime.date.today()

        if which == "START":
            new_date = self.start_date + datetime.timedelta(days=delta_days)
            if new_date >= today:
                self.start_date = new_date
                if self.end_date < self.start_date:
                    self.end_date = self.start_date
        elif which == "END":
            new_date = self.end_date + datetime.timedelta(days=delta_days)
            if new_date >= self.start_date:
                self.end_date = new_date

        # Clear preset highlight if custom
        for btn in self.preset_buttons.values():
            btn.configure(fg_color=COLORS["input_bg"])

        self._refresh_date_display()

    def _refresh_date_display(self):
        self.from_label.configure(text=self.start_date.strftime("%Y-%m-%d"))
        self.to_label.configure(text=self.end_date.strftime("%Y-%m-%d"))

        total_days = (self.end_date - self.start_date).days + 1
        self.duration_badge.configure(text=f"Duration: {total_days} Day(s)")

        self._check_existing_allocations_for_range()
        self._update_order_calculation()

    # -------------------------------------------------------------
    # MEAL PORTION CARD BUILDER
    # -------------------------------------------------------------
    def _build_meal_portion_card(self, parent, meal_name, sinhala_text, icon, accent_color, attr_name, initial_val):
        card = ctk.CTkFrame(
            parent,
            fg_color=COLORS["input_bg"],
            corner_radius=12,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        card.pack(fill="x", pady=4)

        # Left info
        left_info = ctk.CTkFrame(card, fg_color="transparent")
        left_info.pack(side="left", padx=14, pady=8)

        title_row = ctk.CTkFrame(left_info, fg_color="transparent")
        title_row.pack(anchor="w")

        ctk.CTkLabel(title_row, text=icon, font=(FONT_FAMILY, 18)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(
            title_row,
            text=f"{meal_name}  ({sinhala_text})",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_main"],
        ).pack(side="left")

        # Right Counters
        ctrl_box = ctk.CTkFrame(card, fg_color="transparent")
        ctrl_box.pack(side="right", padx=14, pady=8)

        minus_btn = ctk.CTkButton(
            ctrl_box,
            text="−",
            font=(FONT_FAMILY, 15, "bold"),
            width=34,
            height=34,
            fg_color=COLORS["card_border"],
            command=lambda: self._adjust_meal_qty(attr_name, -1),
        )
        minus_btn.pack(side="left", padx=3)

        val_label = ctk.CTkLabel(
            ctrl_box,
            text=str(initial_val),
            font=(FONT_FAMILY, 15, "bold"),
            width=28,
        )
        val_label.pack(side="left", padx=3)
        setattr(self, f"{attr_name}_label", val_label)

        plus_btn = ctk.CTkButton(
            ctrl_box,
            text="+",
            font=(FONT_FAMILY, 15, "bold"),
            width=34,
            height=34,
            fg_color=accent_color,
            hover_color=COLORS["accent_teal"],
            command=lambda: self._adjust_meal_qty(attr_name, 1),
        )
        plus_btn.pack(side="left", padx=3)

    def _adjust_meal_qty(self, attr_name, delta):
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        curr = getattr(self, f"{attr_name}_qty")
        new_val = max(0, min(5, curr + delta))
        setattr(self, f"{attr_name}_qty", new_val)
        lbl = getattr(self, f"{attr_name}_label", None)
        if lbl:
            lbl.configure(text=str(new_val))
        self._update_order_calculation()

    def _update_order_calculation(self):
        total_days = (self.end_date - self.start_date).days + 1
        daily_portions = self.breakfast_qty + self.lunch_qty + self.dinner_qty
        total_meals = daily_portions * total_days

        calc_text = (
            f"Daily: {self.breakfast_qty}B + {self.lunch_qty}L + {self.dinner_qty}D = {daily_portions} portion(s)/day  |  "
            f"Total: {total_days} Day(s) × {daily_portions} = {total_meals} Meals"
        )
        self.summary_calc_label.configure(text=calc_text)

    # -------------------------------------------------------------
    # EXISTING ALLOCATIONS VERIFICATION & ALERT
    # -------------------------------------------------------------
    def _check_existing_allocations_for_range(self):
        if not self.current_employee:
            return

        emp_id = self.current_employee.get("emp_id")
        start_str = self.start_date.strftime("%Y-%m-%d")
        end_str = self.end_date.strftime("%Y-%m-%d")

        def check_task():
            ok, res = self.api.check_allocations(emp_id, start_str, end_str)
            if ok:
                has_existing = res.get("hasExisting", False)
                allocs = res.get("allocations", [])
                self.after(0, lambda: self._render_existing_alert(has_existing, allocs, start_str, end_str))

        threading.Thread(target=check_task, daemon=True).start()

    def _render_existing_alert(self, has_existing, allocs, start_str, end_str):
        if not hasattr(self, "alert_banner"):
            return

        if has_existing and len(allocs) > 0:
            # Group by meal type
            b_count = len([a for a in allocs if a.get("meal_type") == "Breakfast"])
            l_count = len([a for a in allocs if a.get("meal_type") == "Lunch"])
            d_count = len([a for a in allocs if a.get("meal_type") == "Dinner"])

            breakdown = []
            if b_count: breakdown.append(f"Breakfast: {b_count}")
            if l_count: breakdown.append(f"Lunch: {l_count}")
            if d_count: breakdown.append(f"Dinner: {d_count}")
            breakdown_str = ", ".join(breakdown)

            self.alert_banner.configure(fg_color="#422006", border_width=1, border_color="#f59e0b")
            self.alert_label.configure(
                text=f"ℹ️ Notice: Meals have already been ordered for this period ({breakdown_str}).",
                text_color="#fbbf24",
            )
        else:
            self.alert_banner.configure(fg_color="#064e3b", border_width=1, border_color="#10b981")
            self.alert_label.configure(
                text="✅ All selected dates are clear. No existing allocations found for this range.",
                text_color="#34d399",
            )

    def _render_upcoming_allocations_list(self):
        # Clear list
        for w in self.alloc_scroll.winfo_children():
            w.destroy()

        if not self.upcoming_allocations:
            ctk.CTkLabel(
                self.alloc_scroll,
                text="No existing meal bookings found for the next 7 days.",
                font=(FONT_FAMILY, 11),
                text_color=COLORS["text_muted"],
            ).pack(pady=20)
            return

        for alloc in self.upcoming_allocations:
            item = ctk.CTkFrame(self.alloc_scroll, fg_color=COLORS["input_bg"], corner_radius=8)
            item.pack(fill="x", pady=3)

            left_box = ctk.CTkFrame(item, fg_color="transparent")
            left_box.pack(side="left", padx=10, pady=6)

            ctk.CTkLabel(
                left_box, text=alloc.get("date", ""), font=(FONT_FAMILY, 11, "bold"), text_color=COLORS["text_main"]
            ).pack(anchor="w")

            meal_type = alloc.get("meal_type", "Meal")
            meal_color = "#f59e0b" if meal_type == "Breakfast" else ("#10b981" if meal_type == "Lunch" else "#ef4444")
            ctk.CTkLabel(
                left_box, text=f"{meal_type} (Qty: {alloc.get('quantity', 1)})", font=(FONT_FAMILY, 10, "bold"), text_color=meal_color
            ).pack(anchor="w")

            status = alloc.get("status", "Ordered")
            tag_color = COLORS["accent_green"] if status == "Received" or alloc.get("received") else COLORS["accent_teal"]
            tag_text = "🍲 Received" if status == "Received" or alloc.get("received") else "🟢 Ordered"

            ctk.CTkLabel(
                item, text=tag_text, font=(FONT_FAMILY, 10, "bold"), text_color=tag_color
            ).pack(side="right", padx=10)

    # -------------------------------------------------------------
    # SUBMIT ORDER TO CLOUD FUNCTIONS
    # -------------------------------------------------------------
    def _submit_order(self):
        if self.breakfast_qty == 0 and self.lunch_qty == 0 and self.dinner_qty == 0:
            play_warning_beep()
            return

        self.submit_btn.configure(
            text="Submitting Order to Cloud Functions...",
            state="disabled",
            fg_color=COLORS["card_border"],
        )

        emp = self.current_employee or {}
        emp_id = str(emp.get("emp_id") or emp.get("employee_id") or emp.get("id") or "").strip()
        first_name = emp.get("first_name", "")
        last_name = emp.get("last_name", "")
        emp_name = (
            emp.get("name")
            or emp.get("full_name")
            or f"{first_name} {last_name}".strip()
            or f"Employee {emp_id}"
        )
        emp_dept = emp.get("department") or emp.get("section") or emp.get("designation") or "Operations"
        emp_cat = emp.get("pay_category") or emp.get("category_employment") or "Staff"

        start_str = self.start_date.strftime("%Y-%m-%d")
        end_str = self.end_date.strftime("%Y-%m-%d")

        def submit_task():
            ok, res = self.api.place_meal_order(
                emp_id=emp_id,
                emp_name=emp_name,
                start_date=start_str,
                end_date=end_str,
                breakfast=self.breakfast_qty,
                lunch=self.lunch_qty,
                dinner=self.dinner_qty,
                department=emp_dept,
                pay_category=emp_cat,
            )
            t_now = datetime.datetime.now().strftime("%H:%M:%S")
            if ok and res.get("success"):
                play_success_beep()
                c_cnt = res.get("createdCount", 0)
                self._append_log(f"[{t_now}] 📦 [ORDER PLACED] {emp_id} - {emp_name}: {c_cnt} allocations ({start_str} -> {end_str})")
                self.after(0, lambda: self._show_order_success(res, start_str, end_str))
            else:
                play_error_beep()
                msg = res.get("message", "Failed to place meal order.")
                self._append_log(f"[{t_now}] ❌ [ORDER FAILED] {emp_id}: {msg}")
                self.after(0, lambda: self._show_order_failed(msg))

        threading.Thread(target=submit_task, daemon=True).start()

    def _show_order_success(self, res, start_str, end_str):
        for widget in self.main_container.winfo_children():
            widget.destroy()

        success_card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=2,
            border_color=COLORS["accent_green"],
        )
        success_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.82, relheight=0.75)

        created_count = res.get("createdCount", 0)

        if created_count > 0:
            icon_char = "✅"
            title_text = "MEAL ORDER PROCESSED!"
            title_color = COLORS["accent_green"]
            sinhala_text = "ආහාර ඇණවුම සාර්ථකව පද්ධතියට එක් කරන ලදී"
            status_text = f"Status: {created_count} new meal allocation(s) created."
        else:
            icon_char = "ℹ️"
            title_text = "MEALS ALREADY ORDERED"
            title_color = COLORS["accent_yellow"]
            sinhala_text = "මෙම දිනයන් සඳහා ආහාර දැනටමත් ඇණවුම් කර ඇත"
            status_text = "Status: Meals have already been booked for this date range."

        ctk.CTkLabel(success_card, text=icon_char, font=(FONT_FAMILY, 58)).pack(pady=(25, 4))
        ctk.CTkLabel(
            success_card,
            text=title_text,
            font=(FONT_FAMILY, 20, "bold"),
            text_color=title_color,
        ).pack(pady=(0, 2))
        ctk.CTkLabel(
            success_card,
            text=sinhala_text,
            font=(FONT_FAMILY, 14),
            text_color=COLORS["text_main"],
        ).pack(pady=(0, 12))

        emp = self.current_employee or {}
        emp_id = emp.get("emp_id") or emp.get("employee_id") or emp.get("id") or ""
        emp_name = (
            emp.get("name")
            or emp.get("full_name")
            or f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            or f"Employee {emp_id}"
        )

        date_display = start_str if start_str == end_str else f"{start_str}  ➔  {end_str}"
        summary_text = (
            f"Employee: {emp_id} - {emp_name}\n"
            f"Period: {date_display}\n"
            f"{status_text}"
        )

        info_box = ctk.CTkFrame(success_card, fg_color=COLORS["input_bg"], corner_radius=12)
        info_box.pack(fill="x", padx=40, pady=10, ipady=8)

        ctk.CTkLabel(
            info_box,
            text=summary_text,
            font=(FONT_FAMILY, 12),
            text_color=COLORS["text_main"],
            justify="center",
        ).pack()

        # Return Button
        ctk.CTkButton(
            success_card,
            text="Done / Back to Home (ආපසු මුල් පිටුවට)",
            font=(FONT_FAMILY, 13, "bold"),
            fg_color=COLORS["accent_green"],
            hover_color=COLORS["accent_teal"],
            height=40,
            command=self.show_standby_screen,
        ).pack(pady=(12, 0))

        # Auto return to standby after 5s
        self.after(5000, self.show_standby_screen)

    def _show_order_failed(self, error_msg):
        self.submit_btn.configure(
            text="CONFIRM & PLACE ORDER  |  ඇණවුම් කරන්න",
            state="normal",
            fg_color=COLORS["accent_green"],
        )
        error_dialog = ctk.CTkLabel(
            self.main_container,
            text=f"⚠️ {error_msg}",
            font=(FONT_FAMILY, 12, "bold"),
            text_color=COLORS["accent_red"],
        )
        error_dialog.pack(pady=5)
        self.after(4000, error_dialog.destroy)

    def _run_countdown(self):
        if not self.countdown_active:
            return
        if self.countdown_remaining <= 0:
            self.show_standby_screen()
            return

        self.countdown_remaining -= 1
        if hasattr(self, "logout_btn"):
            self.logout_btn.configure(
                text=f"Cancel / Exit ({self.countdown_remaining}s)"
            )
        self.after(1000, self._run_countdown)


def main():
    app = OrderingKioskApp()
    app.mainloop()


if __name__ == "__main__":
    main()
