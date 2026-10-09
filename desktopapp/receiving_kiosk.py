"""
Hayleys Meal Management System - Receiving & Dispensing Kiosk Application
Enhanced Touchscreen POS UI with On-Screen Touch Keypad & Dark Navy Blue Buttons
Embedded ZKTeco MB360 ADMS Middleware (Port 4370)
Supports Interactive Ordered Meal Selection, Timeslot Serving Window Enforcement & 0ms Instant Login
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
    SERVING_WINDOWS,
)
from desktopapp.api_client import CloudApiClient
from desktopapp.middleware import BiometricMiddlewareServer, get_local_ip_addresses
from desktopapp.sound_utils import play_success_beep, play_error_beep, play_warning_beep
from desktopapp.i18n import get_text, get_trilingual
import urllib.request

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("green")


def check_meal_timeslot(meal_type, override=False):
    win = SERVING_WINDOWS.get(meal_type, {"start_hour": 0, "start_min": 0, "end_hour": 23, "end_min": 59, "display": "All Day"})
    window_display = win["display"]
    if override:
        return True, window_display, "🔓 Admin Override Active (641)  |  පරිපාලක අවසරය"

    now = datetime.datetime.now()
    total_mins = now.hour * 60 + now.minute
    start_total = win["start_hour"] * 60 + win["start_min"]
    end_total = win["end_hour"] * 60 + win["end_min"]

    if total_mins < start_total:
        mins_until = start_total - total_mins
        hrs = mins_until // 60
        rem = mins_until % 60
        time_until_str = f"in {hrs}h {rem}m" if hrs > 0 else f"in {rem} mins"
        return False, window_display, f"Opens {time_until_str} ({window_display.split(' - ')[0]})  |  තවම විවෘත නැත"
    elif total_mins > end_total:
        return False, window_display, f"Window Ended at {window_display.split(' - ')[1]}  |  වේලාව අවසන්"
    else:
        mins_left = end_total - total_mins
        hrs = mins_left // 60
        rem = mins_left % 60
        time_left_str = f"{hrs}h {rem}m left" if hrs > 0 else f"{rem} mins left"
        return True, window_display, f"Serving Active ({time_left_str})  |  දැන් ලබාගත හැක"


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

        self.title("Hayleys Eco Solutions - Meal Dispensing POS Kiosk")
        self.geometry("1200x820")
        self.minsize(1050, 720)
        self.configure(fg_color=COLORS["bg_dark"])

        # Cloud API & Event Queue (with 0ms In-Memory Preload Cache)
        self.api = CloudApiClient(API_BASE_URL)
        self.event_queue = queue.Queue()
        self.log_history = []

        # State Management
        self.current_employee = None
        self.today_allocations = []
        self.selected_meal_type = None
        self.admin_override = False
        self.countdown_remaining = 30
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
        """Append log message to in-memory history and active textbox if present (Thread-safe)"""
        def _do_append():
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

        try:
            self.after(0, _do_append)
        except Exception:
            _do_append()

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
        if hasattr(self, "clock_label") and self.clock_label.winfo_exists():
            self.clock_label.configure(text=f"🕒 {time_str}  |  {date_str}")
        self.after(1000, self._update_clock)

    def _refresh_today_stats(self):
        def on_stats_done(ok, res):
            if ok and res.get("success"):
                s = res.get("summary", {})
                self.today_total_orders = s.get("totalOrders", 0)
                self.today_dispensed_count = s.get("dispensedCount", 0)
                self.after(0, self._update_stats_ui)

        self.api.get_today_summary_async(callback=on_stats_done)
        self.after(30000, self._refresh_today_stats)

    def _update_stats_ui(self):
        if hasattr(self, "stats_label") and self.stats_label.winfo_exists():
            remaining = max(0, self.today_total_orders - self.today_dispensed_count)
            self.stats_label.configure(
                text=f"📊 Total Orders: {self.today_total_orders}  |  Dispensed: {self.today_dispensed_count} (ලබාදුන් | விநியோகம்)  |  Pending: {remaining} (ඉතිරි)"
            )

    # -------------------------------------------------------------
    # HEADER UI
    # -------------------------------------------------------------
    def _build_header(self):
        header_frame = ctk.CTkFrame(
            self, fg_color=COLORS["card_bg"], corner_radius=14, height=76
        )
        header_frame.pack(fill="x", padx=20, pady=(14, 0))

        brand_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        brand_frame.pack(side="left", padx=18, pady=8)

        title = ctk.CTkLabel(
            brand_frame,
            text="HAYLEYS ECO SOLUTIONS",
            font=(FONT_FAMILY, 19, "bold"),
            text_color="#60A5FA",
        )
        title.pack(anchor="w")

        subtitle = ctk.CTkLabel(
            brand_frame,
            text="Meal Dispensing & Verification Station  |  කෑම ලබාගැනීමේ කියෝස්කය  |  உணவு விநியோகம்",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_muted"],
        )
        subtitle.pack(anchor="w")

        info_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        info_frame.pack(side="right", padx=18, pady=8)

        self.clock_label = ctk.CTkLabel(
            info_frame,
            text="🕒 --:--:--",
            font=(FONT_FAMILY, 15, "bold"),
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
            font=(FONT_FAMILY, 12, "bold"),
            text_color=COLORS["accent_green"]
            if self.middleware_running
            else COLORS["accent_red"],
        )
        status_label.pack(anchor="e")

    # -------------------------------------------------------------
    # STANDBY SCREEN (Split 2-Panel: On-Screen Keypad & Port Listener)
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
        standby_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.98, relheight=0.94)

        # 2-Column Split Grid
        col_grid = ctk.CTkFrame(standby_card, fg_color="transparent")
        col_grid.pack(fill="both", expand=True, padx=16, pady=12)
        col_grid.columnconfigure(0, weight=55)  # Left: Collect & On-Screen Keypad
        col_grid.columnconfigure(1, weight=45)  # Right: Live Port Listener Terminal
        col_grid.rowconfigure(0, weight=1)

        # =========================================================
        # LEFT PANEL: SCANNER, SERVING HOURS & ON-SCREEN KEYPAD
        # =========================================================
        left_panel = ctk.CTkFrame(col_grid, fg_color=COLORS["input_bg"], corner_radius=16)
        left_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 8), pady=0)

        # Prompt Banner
        prompt_box = ctk.CTkFrame(left_panel, fg_color="transparent")
        prompt_box.pack(fill="x", padx=16, pady=(10, 4))

        title_row = ctk.CTkFrame(prompt_box, fg_color="transparent")
        title_row.pack(anchor="center")
        ctk.CTkLabel(title_row, text="🍲", font=(FONT_FAMILY, 28)).pack(side="left", padx=(0, 8))
        ctk.CTkLabel(
            title_row,
            text="SCAN FINGERPRINT OR ENTER ID",
            font=(FONT_FAMILY, 19, "bold"),
            text_color="#60A5FA",
        ).pack(side="left")

        ctk.CTkLabel(
            prompt_box,
            text="කෑම ලබාගැනීමට ඇඟිලි සලකුණ තබන්න හෝ සේවක අංකය ඇතුළත් කරන්න\nதயவுசெய்து உங்கள் கைரேகையை வைக்கவும் அல்லது ஊழியர் எண்ணை உள்ளிடவும்",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_muted"],
            justify="center",
        ).pack(anchor="center", pady=(2, 0))

        # Serving Windows Summary Box (Compact)
        timeslot_card = ctk.CTkFrame(
            left_panel, fg_color=COLORS["card_bg"], corner_radius=10, border_width=1, border_color=COLORS["card_border"]
        )
        timeslot_card.pack(pady=(4, 8), padx=16, fill="x", ipady=4)

        slots_text = (
            f"🕒 Canteen Hours: ☕ Breakfast {SERVING_WINDOWS['Breakfast']['display']} (උදෑසන • காலை)  |  "
            f"🍲 Lunch {SERVING_WINDOWS['Lunch']['display']} (දවල් • மதியம்)  |  "
            f"🍽️ Dinner {SERVING_WINDOWS['Dinner']['display']} (රාත්‍රී • இரவு)"
        )
        ctk.CTkLabel(
            timeslot_card,
            text=slots_text,
            font=(FONT_FAMILY, 11, "bold"),
            text_color=COLORS["accent_green"],
            justify="center",
        ).pack()

        # Stats bar banner
        self.stats_bar_container = ctk.CTkFrame(left_panel, fg_color="#0f172a", corner_radius=8)
        self.stats_bar_container.pack(fill="x", padx=16, pady=(0, 6), ipady=2)

        self.stats_label = ctk.CTkLabel(
            self.stats_bar_container,
            text=f"📊 Total Orders: {self.today_total_orders}  |  Dispensed: {self.today_dispensed_count} (ලබාදුන් | விநியோகம்)",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#38bdf8",
        )
        self.stats_label.pack(anchor="center")

        # =========================================================
        # ON-SCREEN TOUCH KEYPAD CONTAINER
        # =========================================================
        keypad_card = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=14, border_width=1, border_color=COLORS["card_border"])
        keypad_card.pack(fill="x", padx=16, pady=(0, 6), ipady=4)

        # PIN Entry Display Field
        display_frame = ctk.CTkFrame(keypad_card, fg_color="transparent")
        display_frame.pack(fill="x", padx=14, pady=(8, 6))

        self.manual_entry = ctk.CTkEntry(
            display_frame,
            placeholder_text="Enter Employee ID (e.g. 641)  |  සේවක අංකය  |  ஊழியர் எண்",
            font=(FONT_FAMILY, 19, "bold"),
            height=46,
            justify="center",
            fg_color=COLORS["input_bg"],
            border_color="#3B82F6",
            border_width=1,
            text_color=COLORS["text_main"],
        )
        self.manual_entry.pack(fill="x")
        self.manual_entry.bind("<Return>", lambda e: self._manual_login())
        self.manual_entry.bind("<KeyRelease>", self._check_pin_input_for_simulation)

        # Keypad 3x4 Grid
        keypad_grid = ctk.CTkFrame(keypad_card, fg_color="transparent")
        keypad_grid.pack(padx=14, pady=(0, 6))

        keys = [
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["⌫ Del", "0", "Clear 🗑️"]
        ]

        for r_idx, row in enumerate(keys):
            for c_idx, key_label in enumerate(row):
                if key_label == "⌫ Del":
                    btn_color = "#1E293B"
                    hover_color = "#334155"
                    cmd = lambda: self._on_keypad_press("BACKSPACE")
                elif key_label == "Clear 🗑️":
                    btn_color = "#1E293B"
                    hover_color = "#DC2626"
                    cmd = lambda: self._on_keypad_press("CLEAR")
                else:
                    btn_color = COLORS["btn_dark"]
                    hover_color = COLORS["btn_dark_hover"]
                    cmd = lambda k=key_label: self._on_keypad_press(k)

                btn = ctk.CTkButton(
                    keypad_grid,
                    text=key_label,
                    font=(FONT_FAMILY, 16, "bold"),
                    text_color="#FFFFFF",
                    width=105,
                    height=40,
                    fg_color=btn_color,
                    hover_color=hover_color,
                    command=cmd,
                )
                btn.grid(row=r_idx, column=c_idx, padx=4, pady=3)

        # Large Submit Button in Dark Navy Blue with Crisp White Text
        self.dispense_entry_btn = ctk.CTkButton(
            keypad_card,
            text="IDENTIFY & COLLECT  (හඳුනාගෙන ලබාගන්න | அடையாளம்)  ➔",
            font=(FONT_FAMILY, 16, "bold"),
            text_color="#FFFFFF",
            height=48,
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            command=self._manual_login,
        )
        self.dispense_entry_btn.pack(fill="x", padx=14, pady=(4, 8))

        # Simulation Frame: Hidden by default, shown ONLY for Emp ID 641
        self.sim_frame = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=10, border_width=1, border_color="#3b82f6")

        sim_header = ctk.CTkLabel(
            self.sim_frame,
            text="🧪 Developer / Simulation Controls (Emp ID 641 Active):",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#60a5fa",
        )
        sim_header.pack(anchor="w", padx=10, pady=(3, 1))

        sim_btns_row = ctk.CTkFrame(self.sim_frame, fg_color="transparent")
        sim_btns_row.pack(fill="x", padx=10, pady=(0, 4))

        test_punch_btn = ctk.CTkButton(
            sim_btns_row,
            text="🧪 Sim Scan 641",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#FFFFFF",
            height=30,
            fg_color="#1e3a8a",
            hover_color="#2563eb",
            command=lambda: self._simulate_punch("641"),
        )
        test_punch_btn.pack(side="left", fill="x", expand=True, padx=(0, 3))

        test_post_btn = ctk.CTkButton(
            sim_btns_row,
            text="📡 Sim ADMS POST",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#FFFFFF",
            height=30,
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["btn_dark_hover"],
            command=lambda: self._simulate_http_post("641"),
        )
        test_post_btn.pack(side="right", fill="x", expand=True, padx=(3, 0))

        # Spinner Loading Container Box (Hidden until active)
        self.spinner_box = ctk.CTkFrame(
            left_panel,
            fg_color="#0b1329",
            corner_radius=12,
            border_width=1,
            border_color="#3b82f6",
        )

        self.loading_bar = ctk.CTkProgressBar(
            self.spinner_box,
            mode="indeterminate",
            height=6,
            corner_radius=3,
            fg_color="#0F172A",
            progress_color="#38BDF8",
        )

        self.spinner_label = ctk.CTkLabel(
            self.spinner_box,
            text="⏳ Identifying Employee... Please wait",
            font=(FONT_FAMILY, 13, "bold"),
            text_color="#60A5FA",
            wraplength=460,
        )

        # Status Message Banner
        self.standby_status = ctk.CTkLabel(
            left_panel,
            text=f"🟢 ZKTeco Port {self.middleware.port} Active • Ready for scan  |  සූදානම්",
            font=(FONT_FAMILY, 12, "bold"),
            text_color=COLORS["accent_green"] if self.middleware_running else COLORS["accent_red"],
            wraplength=460,
        )
        self.standby_status.pack(side="bottom", pady=8)

        # Right Panel: Terminal
        self._build_right_terminal(col_grid)

    def _start_spinner(self, message):
        def _do_start():
            self.is_spinning = True
            self.spinner_msg = message
            self.spinner_idx = 0

            # Disable manual entry and submit button
            if hasattr(self, "manual_entry") and self.manual_entry.winfo_exists():
                try:
                    self.manual_entry.configure(state="disabled")
                except Exception:
                    pass

            if hasattr(self, "dispense_entry_btn") and self.dispense_entry_btn.winfo_exists():
                try:
                    self.dispense_entry_btn.configure(
                        text="⏳ IDENTIFYING... PLEASE WAIT  (හඳුනාගනිමින් පවතී...)",
                        state="disabled",
                        fg_color="#1e3a8a",
                    )
                except Exception:
                    pass

            # Pack and start spinner box
            if hasattr(self, "spinner_box") and self.spinner_box.winfo_exists():
                try:
                    if not self.spinner_box.winfo_ismapped():
                        if hasattr(self, "standby_status") and self.standby_status.winfo_exists() and self.standby_status.winfo_ismapped():
                            self.spinner_box.pack(fill="x", padx=16, pady=(4, 6), before=self.standby_status)
                        else:
                            self.spinner_box.pack(fill="x", padx=16, pady=(4, 6))
                        self.loading_bar.pack(fill="x", padx=14, pady=(8, 4))
                        self.spinner_label.pack(fill="x", padx=14, pady=(2, 8))
                    self.loading_bar.start()
                except Exception:
                    pass

            self._animate_spinner()
        self.after(0, _do_start)

    def _animate_spinner(self):
        if not getattr(self, "is_spinning", False):
            return
        frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        char = frames[self.spinner_idx % len(frames)]
        self.spinner_idx += 1

        disp_text = f"{char}  {self.spinner_msg}"
        if hasattr(self, "spinner_label") and self.spinner_label.winfo_exists():
            try:
                self.spinner_label.configure(text=disp_text)
            except Exception:
                pass

        if hasattr(self, "standby_status") and self.standby_status.winfo_exists():
            try:
                self.standby_status.configure(
                    text=disp_text,
                    text_color="#60A5FA",
                )
            except Exception:
                pass
        self.after(75, self._animate_spinner)

    def _update_spinner_msg(self, message):
        def _do_upd():
            self.spinner_msg = message
            if hasattr(self, "spinner_label") and self.spinner_label.winfo_exists():
                try:
                    self.spinner_label.configure(text=message)
                except Exception:
                    pass
        self.after(0, _do_upd)

    def _stop_spinner(self):
        def _do_stop():
            self.is_spinning = False
            if hasattr(self, "spinner_box") and self.spinner_box.winfo_exists():
                try:
                    self.loading_bar.stop()
                    self.spinner_box.pack_forget()
                except Exception:
                    pass

            if hasattr(self, "manual_entry") and self.manual_entry.winfo_exists():
                try:
                    self.manual_entry.configure(state="normal")
                except Exception:
                    pass

            if hasattr(self, "dispense_entry_btn") and self.dispense_entry_btn.winfo_exists():
                try:
                    self.dispense_entry_btn.configure(
                        text="IDENTIFY & COLLECT  (හඳුනාගෙන ලබාගන්න | அடையாளம்)  ➔",
                        state="normal",
                        fg_color=COLORS["btn_primary"],
                    )
                except Exception:
                    pass
        self.after(0, _do_stop)

    def _on_keypad_press(self, key_action):
        """Handle on-screen touch keypad inputs"""
        if getattr(self, "is_spinning", False):
            return
        if not hasattr(self, "manual_entry"):
            return
        curr = self.manual_entry.get()
        if key_action == "CLEAR":
            self.manual_entry.delete(0, "end")
        elif key_action == "BACKSPACE":
            if curr:
                self.manual_entry.delete(len(curr) - 1, "end")
        else:
            self.manual_entry.insert("end", str(key_action))
        self._check_pin_input_for_simulation()

    def _check_pin_input_for_simulation(self, event=None):
        """Show simulation tools only when input contains 641"""
        val = self.manual_entry.get().strip() if hasattr(self, "manual_entry") else ""
        if "641" in val or val == "641":
            if hasattr(self, "sim_frame") and not self.sim_frame.winfo_ismapped():
                if hasattr(self, "standby_status") and self.standby_status.winfo_ismapped():
                    self.sim_frame.pack(fill="x", padx=16, pady=(0, 6), before=self.standby_status)
                else:
                    self.sim_frame.pack(fill="x", padx=16, pady=(0, 6))
        else:
            if hasattr(self, "sim_frame") and self.sim_frame.winfo_ismapped():
                self.sim_frame.pack_forget()

    # =========================================================
    # RIGHT PANEL: LIVE PORT LISTENER & TRAFFIC TERMINAL
    # =========================================================
    def _build_right_terminal(self, parent):
        right_panel = ctk.CTkFrame(
            parent,
            fg_color=COLORS["card_bg"],
            corner_radius=16,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        right_panel.grid(row=0, column=1, sticky="nsew", padx=(8, 0), pady=0)

        term_header = ctk.CTkFrame(right_panel, fg_color="transparent")
        term_header.pack(fill="x", padx=14, pady=(14, 6))

        ctk.CTkLabel(
            term_header,
            text="📡 Live Biometric Port Listener | සජීවී පර්යන්තය",
            font=(FONT_FAMILY, 15, "bold"),
            text_color=COLORS["text_main"],
        ).pack(side="left")

        listener_badge = ctk.CTkLabel(
            term_header,
            text=f"● LISTENING : {self.middleware.port}",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#10b981" if self.middleware_running else "#ef4444",
            fg_color="#064e3b" if self.middleware_running else "#450a0a",
            corner_radius=8,
            padx=10,
            pady=4,
        )
        listener_badge.pack(side="right")

        info_strip = ctk.CTkFrame(right_panel, fg_color=COLORS["input_bg"], corner_radius=8)
        info_strip.pack(fill="x", padx=14, pady=(0, 6), ipady=4)

        primary_ip = self.local_ips[0] if self.local_ips else "127.0.0.1"
        all_ips_str = ", ".join([f"{ip}:{self.middleware.port}" for ip in self.local_ips])

        ctk.CTkLabel(
            info_strip,
            text=f"🌐 Server IP: {all_ips_str}\n🎯 ZKTeco ADMS URL: http://{primary_ip}:{self.middleware.port}/iclock/cdata",
            font=(FONT_FAMILY, 11, "bold"),
            text_color=COLORS["text_muted"],
            justify="left",
        ).pack(anchor="w", padx=8, pady=2)

        self.log_textbox = ctk.CTkTextbox(
            right_panel,
            font=("Consolas", 11),
            fg_color="#080d14",
            text_color="#34d399",
            corner_radius=10,
            border_width=1,
            border_color="#1f293d",
            wrap="char",
        )
        self.log_textbox.pack(fill="both", expand=True, padx=14, pady=(0, 8))

        self.log_textbox.configure(state="normal")
        for log_line in self.log_history:
            self.log_textbox.insert("end", log_line + "\n")
        self.log_textbox.see("end")
        self.log_textbox.configure(state="disabled")

        term_actions = ctk.CTkFrame(right_panel, fg_color="transparent")
        term_actions.pack(fill="x", padx=14, pady=(0, 10))

        clear_btn = ctk.CTkButton(
            term_actions,
            text="🗑️ Clear (මකන්න | அழி)",
            font=(FONT_FAMILY, 12, "bold"),
            text_color="#FFFFFF",
            height=32,
            width=135,
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["btn_dark_hover"],
            command=self._clear_terminal_log,
        )
        clear_btn.pack(side="left")

        copy_btn = ctk.CTkButton(
            term_actions,
            text="📋 Copy ADMS URL",
            font=(FONT_FAMILY, 12, "bold"),
            text_color="#FFFFFF",
            height=32,
            width=140,
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["btn_primary_hover"],
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
        if getattr(self, "is_spinning", False):
            return
        pin = self.manual_entry.get().strip() if hasattr(self, "manual_entry") else ""
        if pin:
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            self._append_log(f"[{now_str}] ⌨️ [MANUAL INPUT] User submitted ID: '{pin}'")
            self._handle_employee_scan(pin)

    # -------------------------------------------------------------
    # EMPLOYEE VERIFICATION & MEAL SELECTION SCREEN
    # -------------------------------------------------------------
    def _handle_employee_scan(self, pin):
        if getattr(self, "is_spinning", False):
            return
        pin = str(pin).strip()
        if not pin:
            return

        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self._append_log(f"[{now_str}] 🔍 Identifying Employee '{pin}'...")
        if hasattr(self, "dispense_entry_btn") and self.dispense_entry_btn.winfo_exists():
            self.dispense_entry_btn.configure(state="disabled")

        self._start_spinner(f"Identifying Employee {pin}...  |  සේවකයා හඳුනාගනිමින් පවතී...  |  சரிபார்க்கிறது...")

        def on_verified(ok, res):
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

                cached_tag = " (Local Cache Hit ⚡)" if res.get("cached") else ""
                self._append_log(f"[{t_now}] ✅ [AUTH SUCCESS]{cached_tag} Employee Verified: {emp_name} (ID: {emp_id})")
                self._update_spinner_msg(f"✅ Verified: {emp_name} (ID: {emp_id}) • 📋 Loading meal bookings...  |  ආහාර තොරතුරු ලබාගනිමින් පවතී...")

                # Fetch today's meal allocations asynchronously while keeping the spinner running
                today_str = datetime.date.today().strftime("%Y-%m-%d")

                def on_orders_ready(ok_alloc, alloc_res):
                    allocs = alloc_res.get("data", []) if ok_alloc else []
                    play_success_beep()
                    self._stop_spinner()
                    self.after(0, lambda: self.show_meal_selection_screen(emp, allocs))

                self.api.get_employee_orders_async(emp_id, days=1, start_date=today_str, callback=on_orders_ready)
            else:
                play_error_beep()
                self._stop_spinner()
                msg = res.get("message", f"Employee '{pin}' is not registered or inactive.")
                self._append_log(f"[{t_now}] ❌ [AUTH FAILED] {msg}")
                self.after(0, lambda: self._show_login_error(msg))

        self.api.verify_employee_async(pin, callback=on_verified)

    def _show_login_error(self, msg):
        if hasattr(self, "dispense_entry_btn") and self.dispense_entry_btn.winfo_exists():
            self.dispense_entry_btn.configure(state="normal")

        if hasattr(self, "standby_status") and self.standby_status.winfo_exists():
            self.standby_status.configure(
                text=f"❌ {msg}", text_color=COLORS["accent_red"]
            )
            self.after(
                4000,
                lambda: self.standby_status.configure(
                    text=f"🟢 ZKTeco Port {self.middleware.port} Active • Ready for scan  |  සූදානම්",
                    text_color=COLORS["accent_green"],
                )
                if hasattr(self, "standby_status") and self.standby_status.winfo_exists()
                else None,
            )

    def show_meal_selection_screen(self, employee, today_allocations=None):
        self.current_employee = employee
        self.today_allocations = today_allocations or []
        self.selected_meal_type = None
        self.countdown_remaining = 30
        self.countdown_active = True

        emp_id = str(employee.get("emp_id") or employee.get("employee_id") or employee.get("id") or "").strip()
        # Strictly enforce override capability ONLY for Employee 641
        is_admin_user = (emp_id == "641")
        if not is_admin_user:
            self.admin_override = False
        else:
            self.admin_override = False  # Start unchecked, user can toggle if needed

        for widget in self.main_container.winfo_children():
            widget.destroy()

        sel_card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=1,
            border_color=COLORS["card_border"],
        )
        sel_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.96, relheight=0.94)
        self.sel_card = sel_card

        # Top Bar: Employee Profile Info & Cancel / Override Controls
        top_profile = ctk.CTkFrame(sel_card, fg_color=COLORS["input_bg"], corner_radius=12)
        top_profile.pack(fill="x", padx=18, pady=(14, 8), ipady=4)

        emp_name = (
            employee.get("name")
            or employee.get("full_name")
            or f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            or f"Employee {emp_id}"
        )
        emp_dept = employee.get("department") or employee.get("section") or employee.get("designation") or "Operations"
        emp_cat = employee.get("pay_category") or employee.get("category_employment") or "Staff"

        left_prof = ctk.CTkFrame(top_profile, fg_color="transparent")
        left_prof.pack(side="left", padx=14, pady=4)

        ctk.CTkLabel(
            left_prof,
            text=f"👤 {emp_name}  (ID: {emp_id})",
            font=(FONT_FAMILY, 17, "bold"),
            text_color=COLORS["text_main"],
        ).pack(anchor="w")

        ctk.CTkLabel(
            left_prof,
            text=f"Department: {emp_dept}  |  Category: {emp_cat}",
            font=(FONT_FAMILY, 13, "bold"),
            text_color="#60A5FA",
        ).pack(anchor="w")

        right_prof = ctk.CTkFrame(top_profile, fg_color="transparent")
        right_prof.pack(side="right", padx=14, pady=4)

        self.logout_btn = ctk.CTkButton(
            right_prof,
            text=f"Cancel / Exit (පිටවන්න | வெளியேறு) ({self.countdown_remaining}s)",
            font=(FONT_FAMILY, 13, "bold"),
            text_color="#FFFFFF",
            width=180,
            height=38,
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["accent_red"],
            command=self.show_standby_screen,
        )
        self.logout_btn.pack(side="right", padx=(8, 0))

        # Admin Override Checkbox ONLY for Emp ID 641
        if is_admin_user:
            self.override_chk = ctk.CTkCheckBox(
                right_prof,
                text="Admin Override (Bypass Serving Window for 641)",
                font=(FONT_FAMILY, 12, "bold"),
                text_color="#60a5fa",
                command=self._on_override_toggle,
            )
            self.override_chk.pack(side="right", padx=(0, 6))

        # Guidance Title Row
        instruction_frame = ctk.CTkFrame(sel_card, fg_color="transparent")
        instruction_frame.pack(fill="x", padx=20, pady=(2, 6))

        ctk.CTkLabel(
            instruction_frame,
            text="Select Your Ordered Meal Portion (ලබාගන්නා ආහාරය තෝරන්න | உணவைத் தேர்ந்தெடுக்கவும்):",
            font=(FONT_FAMILY, 16, "bold"),
            text_color=COLORS["text_main"],
        ).pack(side="left")

        today_date_str = datetime.date.today().strftime("%A, %d %B %Y")
        ctk.CTkLabel(
            instruction_frame,
            text=f"📅 {today_date_str}",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_muted"],
        ).pack(side="right")

        # 3 Meal Cards Row Container (Responsive 3-Column Grid)
        self.cards_row = ctk.CTkFrame(sel_card, fg_color="transparent")
        self.cards_row.pack(fill="both", expand=True, padx=16, pady=0)
        self.cards_row.columnconfigure(0, weight=1)
        self.cards_row.columnconfigure(1, weight=1)
        self.cards_row.columnconfigure(2, weight=1)
        self.cards_row.rowconfigure(0, weight=1)

        # Status / Reason Guidance Bar above the confirmation button
        self.status_bar_frame = ctk.CTkFrame(sel_card, fg_color=COLORS["input_bg"], corner_radius=10)
        self.status_bar_frame.pack(fill="x", padx=18, pady=(8, 6), ipady=4)

        self.status_bar_label = ctk.CTkLabel(
            self.status_bar_frame,
            text="Please select an available meal above to collect.  |  කරුණාකර ආහාරයක් තෝරන්න.",
            font=(FONT_FAMILY, 14, "bold"),
            text_color="#60A5FA",
        )
        self.status_bar_label.pack(anchor="center", padx=10)

        # Bottom Confirmation / Dispense Button Frame
        bottom_action_frame = ctk.CTkFrame(sel_card, fg_color="transparent")
        bottom_action_frame.pack(fill="x", padx=18, pady=(0, 14))

        self.dispense_btn = ctk.CTkButton(
            bottom_action_frame,
            text="COLLECT & DISPENSE MEAL  |  ආහාර ලබාගන්න  |  உணவை பெறுக  ➔",
            font=(FONT_FAMILY, 17, "bold"),
            text_color="#FFFFFF",
            height=56,
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            command=self._dispense_selected_meal,
        )
        self.dispense_btn.pack(fill="x")

        # Build meal cards with detailed status reasons
        self._build_meal_cards_ui()

        # Run countdown
        self._run_countdown()

    def _build_meal_cards_ui(self):
        """Render meal selection cards dynamically with explicit reasons for disabled states"""
        if not hasattr(self, "cards_row") or not self.cards_row.winfo_exists():
            return

        for w in self.cards_row.winfo_children():
            w.destroy()

        meal_slots = [
            ("Breakfast", "උදෑසන • காலை", "☕", "#f59e0b", 0),
            ("Lunch", "දිවා ආහාරය • மதிய உணவு", "🍲", "#10b981", 1),
            ("Dinner", "රාත්‍රී ආහාරය • இரவு உணவு", "🍽️", "#ef4444", 2),
        ]

        active_time_slot = get_current_time_slot()
        self.meal_card_frames = {}
        best_candidate = None
        available_count = 0

        for meal_key, sinhala_title, icon, accent_col, col_idx in meal_slots:
            alloc = next((a for a in self.today_allocations if a.get("meal_type") == meal_key), None)
            is_ordered = alloc is not None
            is_received = is_ordered and (alloc.get("received") or (alloc.get("status") or "").lower() in ["received", "recieved"])
            is_valid_time, window_desc, time_reason = check_meal_timeslot(meal_key, self.admin_override)
            is_ready = (is_ordered and not is_received and is_valid_time) or (self.admin_override and not is_received)

            if is_ready:
                available_count += 1
                if meal_key == active_time_slot:
                    best_candidate = meal_key
                elif best_candidate is None:
                    best_candidate = meal_key

            # Determine card style and disabled reason
            if is_ready:
                card_border = "#1E3A8A"
                card_bg = COLORS["input_bg"]
                status_badge_text = "✅ Ready to Collect\nලබාගැනීමට සූදානම් | பெற தயார்"
                status_badge_bg = "#0c4a6e"
                status_badge_fg = "#38bdf8"
                reason_title = "🟢 Active Booking | වෙන්කර ඇත"
                reason_desc = f"Ordered (Qty: {alloc.get('quantity', 1) if alloc else 1})\nServing: {window_desc}"
            elif is_received:
                card_border = "#064e3b"
                card_bg = "#0a1914"
                status_badge_text = "🍲 Already Received\nලබාගෙන ඇත | பெறப்பட்டது"
                status_badge_bg = "#064e3b"
                status_badge_fg = "#34d399"
                reason_title = "🔒 Already Dispensed | ලබාගෙන ඇත"
                reason_desc = "Meal portion was already\ndispensed today."
            elif not is_ordered and not self.admin_override:
                card_border = "#1e293b"
                card_bg = "#0d131f"
                status_badge_text = "❌ Not Ordered Today\nඇණවුම් කර නැත | ஆர்டர் இல்லை"
                status_badge_bg = "#1e293b"
                status_badge_fg = "#94a3b8"
                reason_title = "🚫 No Advance Booking | වෙන්කර නොමැත"
                reason_desc = "Must be booked in advance\nat the Ordering Kiosk."
            else:  # Outside serving window
                card_border = "#451a03"
                card_bg = "#191107"
                status_badge_text = "⏳ Window Closed\nවේලාව අවසන් | நேரம் முடிந்தது"
                status_badge_bg = "#451a03"
                status_badge_fg = "#fbbf24"
                reason_title = "⏰ Outside Serving Hours"
                reason_desc = f"{time_reason}\nServing: {window_desc}"

            card = ctk.CTkFrame(
                self.cards_row,
                fg_color=card_bg,
                corner_radius=16,
                border_width=2,
                border_color=card_border,
            )
            card.grid(row=0, column=col_idx, sticky="nsew", padx=6, pady=2, ipady=8)
            self.meal_card_frames[meal_key] = card

            if is_ready or self.admin_override:
                card.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))
                card.configure(cursor="hand2")

            # Icon & Title Header
            icon_lbl = ctk.CTkLabel(card, text=icon, font=(FONT_FAMILY, 40))
            icon_lbl.pack(pady=(8, 0))
            if is_ready or self.admin_override:
                icon_lbl.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

            title_lbl = ctk.CTkLabel(
                card, text=meal_key, font=(FONT_FAMILY, 17, "bold"), text_color=accent_col
            )
            title_lbl.pack()
            if is_ready or self.admin_override:
                title_lbl.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

            sub_lbl = ctk.CTkLabel(
                card, text=sinhala_title, font=(FONT_FAMILY, 12, "bold"), text_color=COLORS["text_muted"]
            )
            sub_lbl.pack(pady=(0, 4))
            if is_ready or self.admin_override:
                sub_lbl.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

            # Status Badge Pill
            status_badge = ctk.CTkLabel(
                card,
                text=status_badge_text,
                font=(FONT_FAMILY, 12, "bold"),
                text_color=status_badge_fg,
                fg_color=status_badge_bg,
                corner_radius=8,
                padx=10,
                pady=4,
            )
            status_badge.pack(pady=(2, 4))
            if is_ready or self.admin_override:
                status_badge.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

            # Detailed Reason / Explanation Frame
            reason_box = ctk.CTkFrame(card, fg_color="#080e1a", corner_radius=8, border_width=1, border_color="#1e293b")
            reason_box.pack(fill="x", padx=10, pady=(4, 6), ipady=3)
            if is_ready or self.admin_override:
                reason_box.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

            ctk.CTkLabel(
                reason_box,
                text=reason_title,
                font=(FONT_FAMILY, 11, "bold"),
                text_color=status_badge_fg,
            ).pack(anchor="w", padx=8, pady=(2, 0))

            reason_desc_lbl = ctk.CTkLabel(
                reason_box,
                text=reason_desc,
                font=(FONT_FAMILY, 11),
                text_color=COLORS["text_muted"],
                justify="left",
            )
            reason_desc_lbl.pack(anchor="w", padx=8, pady=(0, 2))
            if is_ready or self.admin_override:
                reason_desc_lbl.bind("<Button-1>", lambda e, k=meal_key: self._select_meal_for_dispense(k))

        if best_candidate:
            self._select_meal_for_dispense(best_candidate)
        elif self.admin_override:
            self._select_meal_for_dispense(active_time_slot or "Lunch")
        else:
            self.selected_meal_type = None
            if hasattr(self, "status_bar_label") and self.status_bar_label.winfo_exists():
                self.status_bar_frame.configure(fg_color="#451a03", border_width=1, border_color="#f59e0b")
                self.status_bar_label.configure(
                    text="⛔ Dispensing disabled: No booked meals are currently within their active serving hours.  |  දැනට ලබාගත හැකි ආහාර නොමැත.",
                    font=(FONT_FAMILY, 13, "bold"),
                    text_color="#fbbf24",
                )
            if hasattr(self, "dispense_btn") and self.dispense_btn.winfo_exists():
                self.dispense_btn.configure(
                    text="⛔ NO MEALS AVAILABLE FOR IMMEDIATE DISPENSING  |  ලබාගත හැකි ආහාර නොමැත",
                    font=(FONT_FAMILY, 15, "bold"),
                    state="disabled",
                    fg_color="#1e293b",
                    text_color="#64748b",
                )

    def _on_override_toggle(self):
        # Only Emp 641 can toggle
        emp_id = str(self.current_employee.get("emp_id") if self.current_employee else "").strip()
        if emp_id == "641":
            self.admin_override = (self.override_chk.get() == 1) if hasattr(self, "override_chk") else False
        else:
            self.admin_override = False
        self._build_meal_cards_ui()

    def _select_meal_for_dispense(self, meal_key):
        self.selected_meal_type = meal_key

        for k, frame in self.meal_card_frames.items():
            if k == meal_key:
                frame.configure(border_color="#3B82F6", border_width=3, fg_color="#0e1e38")
            else:
                frame.configure(border_color="#1e293b", border_width=1, fg_color=COLORS["input_bg"])

        if hasattr(self, "status_bar_label") and self.status_bar_label.winfo_exists():
            self.status_bar_frame.configure(fg_color="#064e3b", border_width=1, border_color="#10b981")
            self.status_bar_label.configure(
                text=f"👉 Selected: {meal_key.upper()} Portion • Ready for Dispensing  |  ලබාගැනීමට සූදානම්  |  உணவை பெறலாம்",
                font=(FONT_FAMILY, 14, "bold"),
                text_color="#34d399",
            )

        if hasattr(self, "dispense_btn") and self.dispense_btn.winfo_exists():
            self.dispense_btn.configure(
                text=f"CONFIRM & DISPENSE {meal_key.upper()}  |  ආහාර ලබාගන්න  |  உணவை பெறுக  ➔",
                font=(FONT_FAMILY, 17, "bold"),
                state="normal",
                fg_color=COLORS["btn_primary"],
                hover_color=COLORS["btn_primary_hover"],
                text_color="#FFFFFF",
            )

    def _dispense_selected_meal(self):
        if not self.selected_meal_type:
            play_warning_beep()
            return

        self.dispense_btn.configure(
            text="⏳ Dispensing & Recording in Cloud Functions...  |  සටහන් කරමින් පවතී...",
            font=(FONT_FAMILY, 15, "bold"),
            state="disabled",
            fg_color="#1e3a8a",
        )

        emp = self.current_employee or {}
        emp_id = str(emp.get("emp_id") or emp.get("employee_id") or emp.get("id") or "").strip()
        meal_type = self.selected_meal_type

        def on_dispense_done(ok, res):
            t_now = datetime.datetime.now().strftime("%H:%M:%S")
            if ok and res.get("dispensed"):
                play_success_beep()
                self._append_log(f"[{t_now}] 🍲 [MEAL DISPENSED] {emp_id} successfully collected {meal_type}")
                self.after(0, lambda: self._show_dispense_success(res, meal_type))
            elif res.get("alreadyDispensed") or res.get("alreadyReceived"):
                play_warning_beep()
                self._append_log(f"[{t_now}] ⚠️ [ALREADY DISPENSED] {emp_id} already received {meal_type}")
                self.after(0, lambda: self._show_already_received(meal_type))
            else:
                play_error_beep()
                msg = res.get("message", f"Failed to dispense {meal_type}")
                self._append_log(f"[{t_now}] ❌ [DISPENSE FAILED] {emp_id}: {msg}")
                self.after(0, lambda: self._show_dispense_error(msg))

        self.api.dispense_meal_async(
            emp_id=emp_id,
            meal_type=meal_type,
            dispensed_by="Receiving Kiosk Station",
            callback=on_dispense_done
        )

    def _show_dispense_success(self, res, meal_type):
        for widget in self.main_container.winfo_children():
            widget.destroy()

        success_card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=2,
            border_color="#3B82F6",
        )
        success_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.84, relheight=0.78)

        ctk.CTkLabel(success_card, text="✅", font=(FONT_FAMILY, 56)).pack(pady=(22, 2))
        ctk.CTkLabel(
            success_card,
            text=f"{meal_type.upper()} DISPENSED SUCCESSFULLY!",
            font=(FONT_FAMILY, 24, "bold"),
            text_color="#60A5FA",
        ).pack(pady=(0, 2))
        ctk.CTkLabel(
            success_card,
            text="කරුණාකර ඔබගේ ආහාරය ලබාගන්න  |  தயவுசெய்து உங்கள் உணவைப் பெற்றுக்கொள்ளுங்கள்",
            font=(FONT_FAMILY, 15, "bold"),
            text_color=COLORS["text_main"],
        ).pack(pady=(0, 10))

        emp = self.current_employee or {}
        emp_id = emp.get("emp_id") or emp.get("employee_id") or emp.get("id") or ""
        emp_name = (
            emp.get("name")
            or emp.get("full_name")
            or f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
            or f"Employee {emp_id}"
        )

        now_time = datetime.datetime.now().strftime("%I:%M:%S %p")
        summary_text = (
            f"Employee: {emp_id} - {emp_name}\n"
            f"Meal: {meal_type} Portion\n"
            f"Dispense Time: {now_time} | Verified"
        )

        info_box = ctk.CTkFrame(success_card, fg_color=COLORS["input_bg"], corner_radius=12)
        info_box.pack(fill="x", padx=40, pady=10, ipady=8)

        ctk.CTkLabel(
            info_box,
            text=summary_text,
            font=(FONT_FAMILY, 14, "bold"),
            text_color=COLORS["text_main"],
            justify="center",
        ).pack()

        ctk.CTkButton(
            success_card,
            text="Done / Back to Home  |  ආපසු මුල් පිටුවට  |  முடிந்தது",
            font=(FONT_FAMILY, 15, "bold"),
            text_color="#FFFFFF",
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            height=48,
            command=self.show_standby_screen,
        ).pack(pady=(12, 0))

        self.after(RECEIVING_BANNER_SEC * 1000, self.show_standby_screen)

    def _show_already_received(self, meal_type):
        for widget in self.main_container.winfo_children():
            widget.destroy()

        card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=2,
            border_color=COLORS["accent_yellow"],
        )
        card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.82, relheight=0.7)

        ctk.CTkLabel(card, text="⚠️", font=(FONT_FAMILY, 54)).pack(pady=(22, 2))
        ctk.CTkLabel(
            card,
            text=f"{meal_type.upper()} ALREADY COLLECTED  |  දැනටමත් ලබාගෙන ඇත",
            font=(FONT_FAMILY, 22, "bold"),
            text_color=COLORS["accent_yellow"],
        ).pack(pady=(0, 2))
        ctk.CTkLabel(
            card,
            text="මෙම ආහාරය අද දින සඳහා දැනටමත් ලබාගෙන ඇත | இந்த உணவு ஏற்கனவே பெறப்பட்டது",
            font=(FONT_FAMILY, 14, "bold"),
            text_color=COLORS["text_main"],
        ).pack(pady=(0, 10))

        ctk.CTkButton(
            card,
            text="Back to Home (ආපසු මුල් පිටුවට | முடிந்தது)",
            font=(FONT_FAMILY, 14, "bold"),
            text_color="#FFFFFF",
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            height=44,
            command=self.show_standby_screen,
        ).pack(pady=14)

        self.after(4000, self.show_standby_screen)

    def _show_dispense_error(self, err_msg):
        self.dispense_btn.configure(
            text="COLLECT & DISPENSE MEAL  |  ආහාර ලබාගන්න  ➔",
            font=(FONT_FAMILY, 17, "bold"),
            state="normal",
            fg_color=COLORS["btn_primary"],
            text_color="#FFFFFF",
        )
        error_dialog = ctk.CTkLabel(
            self.main_container,
            text=f"⚠️ {err_msg}",
            font=(FONT_FAMILY, 14, "bold"),
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
        if hasattr(self, "logout_btn") and self.logout_btn.winfo_exists():
            self.logout_btn.configure(
                text=f"Cancel / Exit (පිටවන්න | வெளியேறு) ({self.countdown_remaining}s)"
            )
        self.after(1000, self._run_countdown)


def main():
    app = ReceivingKioskApp()
    app.mainloop()


if __name__ == "__main__":
    main()
