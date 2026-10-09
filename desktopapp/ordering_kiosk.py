"""
Hayleys Meal Management System - Ordering Kiosk Application
Enhanced Touchscreen POS UI with On-Screen Touch Keypad & Dark Navy Blue Buttons
Embedded ZKTeco MB360 ADMS Middleware (Port 4370)
Supports Dynamic Date Range Scheduling, Live Meal Verification, Time Cutoff Enforcements, and 0ms Instant Login Caching
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
    ORDERING_CUTOFFS,
    SERVING_WINDOWS,
)
from desktopapp.api_client import CloudApiClient
from desktopapp.middleware import BiometricMiddlewareServer, get_local_ip_addresses
from desktopapp.sound_utils import play_success_beep, play_error_beep, play_warning_beep
from desktopapp.i18n import get_text, get_trilingual
import urllib.request

ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("green")


def check_ordering_cutoff(meal_type, start_date, override=False):
    """
    Check if the ordering cutoff for a meal has passed.
    - If ordering for Today: Checks current time against configured cutoff.
    - If ordering for Tomorrow or Future: Always Allowed.
    - If override is True (Admin / Emp 641): Always Allowed.
    Returns: (is_closed, status_message, cutoff_display)
    """
    cutoff_info = ORDERING_CUTOFFS.get(meal_type, {"hour": 12, "minute": 0, "display": "12:00 PM"})
    cutoff_display = cutoff_info["display"]

    if override:
        return False, "🔓 Admin Override Active (641)  |  පරිපාලක අවසරය  |  நிர்வாக அனுமதி", cutoff_display

    today = datetime.date.today()
    if start_date > today:
        return False, f"🟢 Open for Future Booking (Cutoff on day: {cutoff_display})  |  විවෘතයි  |  திறந்துள்ளது", cutoff_display

    # If ordering for Today
    now = datetime.datetime.now()
    cutoff_time = now.replace(
        hour=cutoff_info["hour"],
        minute=cutoff_info["minute"],
        second=0,
        microsecond=0
    )

    if now > cutoff_time:
        return True, f"⛔ Cutoff Passed at {cutoff_display} (Closed for Today)  |  අද සඳහා අවසන්  |  முடிந்தது", cutoff_display
    else:
        mins_left = int((cutoff_time - now).total_seconds() / 60)
        hours_left = mins_left // 60
        rem_mins = mins_left % 60
        time_left_str = f"{hours_left}h {rem_mins}m" if hours_left > 0 else f"{rem_mins} mins"
        return False, f"🟢 Open for Today ({time_left_str} left until {cutoff_display})  |  විවෘතයි  |  திறந்துள்ளது", cutoff_display



class OrderingKioskApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Hayleys Eco Solutions - Meal Ordering POS Kiosk")
        self.geometry("1200x820")
        self.minsize(1050, 720)
        self.configure(fg_color=COLORS["bg_dark"])

        # Cloud API & Event Queue (with 0ms In-Memory Preload Cache)
        self.api = CloudApiClient(API_BASE_URL)
        self.event_queue = queue.Queue()
        self.log_history = []

        # State Management
        self.current_employee = None
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        self.countdown_active = False
        self.admin_override = False
        self.allocation_check_token = 0

        # Meal Quantities
        self.breakfast_qty = 0
        self.lunch_qty = 1  # Default 1 lunch
        self.dinner_qty = 0

        # Date Range State (Defaults to Today -> Today)
        self.start_date = datetime.date.today()
        self.end_date = datetime.date.today()
        self.date_preset = "TODAY"

        # Allocations
        self.upcoming_allocations = []
        self.existing_in_range = []

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
        """Called from middleware background thread upon biometric punch"""
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
        if hasattr(self, "clock_label") and self.clock_label.winfo_exists():
            self.clock_label.configure(text=f"🕒 {time_str}  |  {date_str}")
        self.after(1000, self._update_clock)

    # -------------------------------------------------------------
    # HEADER UI
    # -------------------------------------------------------------
    def _build_header(self):
        header_frame = ctk.CTkFrame(
            self, fg_color=COLORS["card_bg"], corner_radius=14, height=76
        )
        header_frame.pack(fill="x", padx=20, pady=(14, 0))

        # Brand Title & Trilingual Tagline
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
            text="Meal Ordering & Scheduling Kiosk  |  කෑම ඇණවුම් කියෝස්කය  |  உணவு முன்பதிவு",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_muted"],
        )
        subtitle.pack(anchor="w")

        # Clock & Port Status
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
    # STANDBY SCREEN (Split 2-Panel: On-Screen Keypad Login & Port Terminal)
    # -------------------------------------------------------------
    def show_standby_screen(self):
        self.current_employee = None
        self.countdown_active = False
        self.admin_override = False
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
        standby_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.98, relheight=0.94)

        # 2-Column Split Grid
        col_grid = ctk.CTkFrame(standby_card, fg_color="transparent")
        col_grid.pack(fill="both", expand=True, padx=16, pady=12)
        col_grid.columnconfigure(0, weight=55)  # Left: Scanner & On-Screen Keypad
        col_grid.columnconfigure(1, weight=45)  # Right: Live Port Listener Terminal
        col_grid.rowconfigure(0, weight=1)

        # =========================================================
        # LEFT PANEL: SCANNER, CANTEEN CUTOFFS & ON-SCREEN KEYPAD
        # =========================================================
        left_panel = ctk.CTkFrame(col_grid, fg_color=COLORS["input_bg"], corner_radius=16)
        left_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 8), pady=0)

        # Scanner Prompt Banner
        prompt_box = ctk.CTkFrame(left_panel, fg_color="transparent")
        prompt_box.pack(fill="x", padx=16, pady=(8, 3))

        title_row = ctk.CTkFrame(prompt_box, fg_color="transparent")
        title_row.pack(anchor="center")
        ctk.CTkLabel(title_row, text="🖐️", font=(FONT_FAMILY, 24)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(
            title_row,
            text="SCAN FINGERPRINT OR ENTER ID",
            font=(FONT_FAMILY, 16, "bold"),
            text_color="#60A5FA",
        ).pack(side="left")

        ctk.CTkLabel(
            prompt_box,
            text="කරුණාකර ඔබගේ ඇඟිලි සලකුණ තබන්න හෝ සේවක අංකය ඇතුළත් කරන්න\nதயவுசெய்து உங்கள் கைரேகையை வைக்கவும் அல்லது ஊழியர் எண்ணை உள்ளிடவும்",
            font=(FONT_FAMILY, 11, "bold"),
            text_color=COLORS["text_muted"],
            justify="center",
            wraplength=460,
        ).pack(anchor="center", pady=(2, 0))

        # Canteen Cutoff Times Bar (Compact, High-Contrast)
        cutoff_bar = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=10, border_width=1, border_color=COLORS["card_border"])
        cutoff_bar.pack(fill="x", padx=16, pady=(3, 6), ipady=3)

        cutoffs_summary = (
            f"⏰ Cutoffs: Breakfast {ORDERING_CUTOFFS['Breakfast']['display']} (උදෑසන • காலை)  |  "
            f"Lunch {ORDERING_CUTOFFS['Lunch']['display']} (දවල් • மதியம்)  |  "
            f"Dinner {ORDERING_CUTOFFS['Dinner']['display']} (රාත්‍රී • இரவு)"
        )
        ctk.CTkLabel(
            cutoff_bar,
            text=cutoffs_summary,
            font=(FONT_FAMILY, 10, "bold"),
            text_color=COLORS["accent_yellow"],
            justify="center",
            wraplength=460,
        ).pack()

        # =========================================================
        # ON-SCREEN TOUCH KEYPAD CONTAINER
        # =========================================================
        keypad_card = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=14, border_width=1, border_color=COLORS["card_border"])
        keypad_card.pack(fill="x", padx=16, pady=(0, 4), ipady=3)

        # PIN Entry Display Field
        display_frame = ctk.CTkFrame(keypad_card, fg_color="transparent")
        display_frame.pack(fill="x", padx=14, pady=(6, 4))

        self.pin_entry = ctk.CTkEntry(
            display_frame,
            placeholder_text="Enter Employee ID (e.g. 641)  |  සේවක අංකය  |  ஊழியர் எண்",
            font=(FONT_FAMILY, 16, "bold"),
            height=42,
            justify="center",
            fg_color=COLORS["input_bg"],
            border_color="#3B82F6",
            border_width=1,
            text_color=COLORS["text_main"],
        )
        self.pin_entry.pack(fill="x")
        self.pin_entry.bind("<Return>", lambda e: self._manual_login())
        self.pin_entry.bind("<KeyRelease>", self._check_pin_input_for_simulation)

        # Keypad 3x4 Grid
        keypad_grid = ctk.CTkFrame(keypad_card, fg_color="transparent")
        keypad_grid.pack(padx=14, pady=(0, 4))

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
                    font=(FONT_FAMILY, 14, "bold"),
                    text_color="#FFFFFF",
                    width=95,
                    height=36,
                    fg_color=btn_color,
                    hover_color=hover_color,
                    command=cmd,
                )
                btn.grid(row=r_idx, column=c_idx, padx=4, pady=2)

        # Large Submit Button in Dark Navy Blue with Crisp White Text
        self.login_btn = ctk.CTkButton(
            keypad_card,
            text="LOGIN / ENTER  (ඇතුල් වන්න | உள்நுழைக)  ➔",
            font=(FONT_FAMILY, 14, "bold"),
            text_color="#FFFFFF",
            height=42,
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            command=self._manual_login,
        )
        self.login_btn.pack(fill="x", padx=14, pady=(4, 6))

        # Simulation Frame: Hidden by default, ONLY shown for Emp ID 641
        self.sim_frame = ctk.CTkFrame(left_panel, fg_color=COLORS["card_bg"], corner_radius=10, border_width=1, border_color="#3b82f6")

        sim_header = ctk.CTkLabel(
            self.sim_frame,
            text="🧪 Developer / Simulation Controls (Emp ID 641 Active):",
            font=(FONT_FAMILY, 10, "bold"),
            text_color="#60a5fa",
        )
        sim_header.pack(anchor="w", padx=10, pady=(2, 1))

        sim_btns_row = ctk.CTkFrame(self.sim_frame, fg_color="transparent")
        sim_btns_row.pack(fill="x", padx=10, pady=(0, 3))

        test_punch_btn = ctk.CTkButton(
            sim_btns_row,
            text="🧪 Sim Scan 641",
            font=(FONT_FAMILY, 10, "bold"),
            text_color="#FFFFFF",
            height=28,
            fg_color="#1e3a8a",
            hover_color="#2563eb",
            command=lambda: self._simulate_punch("641"),
        )
        test_punch_btn.pack(side="left", fill="x", expand=True, padx=(0, 3))

        test_post_btn = ctk.CTkButton(
            sim_btns_row,
            text="📡 Sim ADMS POST",
            font=(FONT_FAMILY, 10, "bold"),
            text_color="#FFFFFF",
            height=28,
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["btn_dark_hover"],
            command=lambda: self._simulate_http_post("641"),
        )
        test_post_btn.pack(side="right", fill="x", expand=True, padx=(3, 0))

        # Spinner Loading Bar (Indeterminate)
        self.loading_bar = ctk.CTkProgressBar(
            left_panel,
            mode="indeterminate",
            height=4,
            corner_radius=2,
            fg_color="#0F172A",
            progress_color="#3B82F6",
        )

        # Status Message Banner
        self.standby_status = ctk.CTkLabel(
            left_panel,
            text=f"🟢 ZKTeco Port {self.middleware.port} Active • Ready for scan  |  සූදානම්",
            font=(FONT_FAMILY, 11, "bold"),
            text_color=COLORS["accent_green"] if self.middleware_running else COLORS["accent_red"],
            wraplength=460,
        )
        self.standby_status.pack(side="bottom", pady=6)

        # Right Panel: Terminal
        self._build_right_terminal(col_grid)

    def _start_spinner(self, message):
        def _do_start():
            self.is_spinning = True
            self.spinner_msg = message
            self.spinner_idx = 0
            if hasattr(self, "loading_bar") and self.loading_bar.winfo_exists():
                self.loading_bar.pack(fill="x", padx=16, pady=(2, 4), before=self.standby_status)
                self.loading_bar.start()
            self._animate_spinner()
        self.after(0, _do_start)

    def _animate_spinner(self):
        if not getattr(self, "is_spinning", False):
            return
        frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        char = frames[self.spinner_idx % len(frames)]
        self.spinner_idx += 1
        if hasattr(self, "standby_status") and self.standby_status.winfo_exists():
            self.standby_status.configure(
                text=f"{char}  {self.spinner_msg}",
                text_color="#60A5FA",
            )
        self.after(80, self._animate_spinner)

    def _update_spinner_msg(self, message):
        def _do_upd():
            self.spinner_msg = message
        self.after(0, _do_upd)

    def _stop_spinner(self):
        def _do_stop():
            self.is_spinning = False
            if hasattr(self, "loading_bar") and self.loading_bar.winfo_exists():
                try:
                    self.loading_bar.stop()
                    self.loading_bar.pack_forget()
                except Exception:
                    pass
        self.after(0, _do_stop)

    def _on_keypad_press(self, key_action):
        """Handle on-screen touch keypad inputs"""
        if not hasattr(self, "pin_entry"):
            return
        curr = self.pin_entry.get()
        if key_action == "CLEAR":
            self.pin_entry.delete(0, "end")
        elif key_action == "BACKSPACE":
            if curr:
                self.pin_entry.delete(len(curr) - 1, "end")
        else:
            self.pin_entry.insert("end", str(key_action))
        self._check_pin_input_for_simulation()

    def _check_pin_input_for_simulation(self, event=None):
        """Dynamically show simulation buttons ONLY when input contains 641"""
        val = self.pin_entry.get().strip() if hasattr(self, "pin_entry") else ""
        if val == "641" or "641" in val:
            if not self.sim_frame.winfo_ismapped():
                self.sim_frame.pack(fill="x", padx=16, pady=(0, 6), before=self.standby_status)
        else:
            if self.sim_frame.winfo_ismapped():
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
        term_header.pack(fill="x", padx=14, pady=(10, 3))

        ctk.CTkLabel(
            term_header,
            text="📡 Live Biometric Listener",
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_main"],
        ).pack(side="left")

        listener_badge = ctk.CTkLabel(
            term_header,
            text=f"● PORT : {self.middleware.port}",
            font=(FONT_FAMILY, 10, "bold"),
            text_color="#10b981" if self.middleware_running else "#ef4444",
            fg_color="#064e3b" if self.middleware_running else "#450a0a",
            corner_radius=6,
            padx=8,
            pady=2,
        )
        listener_badge.pack(side="right")

        info_strip = ctk.CTkFrame(right_panel, fg_color=COLORS["input_bg"], corner_radius=8)
        info_strip.pack(fill="x", padx=14, pady=(0, 5), ipady=3)

        primary_ip = self.local_ips[0] if self.local_ips else "127.0.0.1"
        all_ips_str = ", ".join([f"{ip}:{self.middleware.port}" for ip in self.local_ips])

        ctk.CTkLabel(
            info_strip,
            text=f"🌐 Server IP: {all_ips_str}\n🎯 ZKTeco ADMS URL:\nhttp://{primary_ip}:{self.middleware.port}/iclock/cdata",
            font=(FONT_FAMILY, 9, "bold"),
            text_color=COLORS["text_muted"],
            justify="left",
            wraplength=360,
        ).pack(anchor="w", padx=8, pady=2)

        self.log_textbox = ctk.CTkTextbox(
            right_panel,
            font=("Consolas", 9),
            fg_color="#080d14",
            text_color="#34d399",
            corner_radius=10,
            border_width=1,
            border_color="#1f293d",
            wrap="char",
        )
        self.log_textbox.pack(fill="both", expand=True, padx=14, pady=(0, 6))

        self.log_textbox.configure(state="normal")
        for log_line in self.log_history:
            self.log_textbox.insert("end", log_line + "\n")
        self.log_textbox.see("end")
        self.log_textbox.configure(state="disabled")

        term_actions = ctk.CTkFrame(right_panel, fg_color="transparent")
        term_actions.pack(fill="x", padx=14, pady=(0, 8))

        clear_btn = ctk.CTkButton(
            term_actions,
            text="🗑️ Clear (මකන්න)",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#FFFFFF",
            height=28,
            width=115,
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["btn_dark_hover"],
            command=self._clear_terminal_log,
        )
        clear_btn.pack(side="left")

        copy_btn = ctk.CTkButton(
            term_actions,
            text="📋 Copy ADMS URL",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#FFFFFF",
            height=28,
            width=125,
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
        pin = self.pin_entry.get().strip() if hasattr(self, "pin_entry") else ""
        if pin:
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            self._append_log(f"[{now_str}] ⌨️ [MANUAL INPUT] User submitted PIN: '{pin}'")
            self._handle_employee_login(pin)

    # -------------------------------------------------------------
    # EMPLOYEE VERIFICATION (Fast Cache Hit & Animated Spinner Feedback)
    # -------------------------------------------------------------
    def _handle_employee_login(self, pin):
        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        self._append_log(f"[{now_str}] 🔍 Verifying Employee '{pin}'...")
        if hasattr(self, "login_btn") and self.login_btn.winfo_exists():
            self.login_btn.configure(state="disabled")

        self._start_spinner(f"Verifying Employee {pin}...  |  හඳුනාගනිමින් පවතී...")

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
                self._update_spinner_msg(f"✅ Verified: {emp_name} • Opening ordering portal...")
                play_success_beep()
                self._stop_spinner()
                self.after(0, lambda: self.show_ordering_screen(emp))
            else:
                play_error_beep()
                self._stop_spinner()
                msg = res.get("message", f"Employee '{pin}' is not registered or inactive.")
                self._append_log(f"[{t_now}] ❌ [AUTH FAILED] {msg}")
                self.after(0, lambda: self._show_login_error(msg))

        self.api.verify_employee_async(pin, callback=on_verified)

    def _show_login_error(self, msg):
        if hasattr(self, "login_btn") and self.login_btn.winfo_exists():
            self.login_btn.configure(state="normal")

        if hasattr(self, "standby_status") and self.standby_status.winfo_exists():
            self.standby_status.configure(
                text=f"❌ {msg}", text_color=COLORS["accent_red"]
            )
            self.after(
                4000,
                lambda: self.standby_status.configure(
                    text=f"🟢 ZKTeco Port {self.middleware.port} Active • Ready for device scan",
                    text_color=COLORS["accent_green"],
                )
                if hasattr(self, "standby_status") and self.standby_status.winfo_exists()
                else None,
            )

    # -------------------------------------------------------------
    # ORDERING SCREEN (Trilingual POS Layout, Large Typography & Cutoffs)
    # -------------------------------------------------------------
    def show_ordering_screen(self, employee, upcoming_allocations=None):
        self.current_employee = employee
        self.upcoming_allocations = upcoming_allocations or []
        self.countdown_remaining = ORDERING_TIMEOUT_SEC
        self.countdown_active = True
        self.admin_override = False

        emp_id = str(employee.get("emp_id") or employee.get("employee_id") or "").strip()
        is_admin_user = (emp_id == "641")

        # Default quantities
        self.breakfast_qty = 0
        self.lunch_qty = 1
        self.dinner_qty = 0

        # Reset date range to Today -> Today
        self.start_date = datetime.date.today()
        self.end_date = datetime.date.today()
        self.date_preset = "TODAY"

        for widget in self.main_container.winfo_children():
            widget.destroy()

        # Split 2-Column Layout: Left (Ordering Form & Meals) | Right (Profile & Allocations)
        grid_container = ctk.CTkFrame(self.main_container, fg_color="transparent")
        grid_container.pack(fill="both", expand=True)
        grid_container.columnconfigure(0, weight=64)  # Left column (Ordering Form)
        grid_container.columnconfigure(1, weight=36)  # Right column (Profile & Bookings)
        grid_container.rowconfigure(0, weight=1)

        # =========================================================
        # LEFT COLUMN: ORDERING FORM, DATE SELECTOR & MEAL CARDS
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
        date_header.pack(fill="x", padx=16, pady=(10, 3))

        ctk.CTkLabel(
            date_header,
            text=get_text("section_1_date_range"),
            font=(FONT_FAMILY, 14, "bold"),
            text_color=COLORS["text_main"],
        ).pack(anchor="w")

        # Preset Buttons Row in Dark Navy Blue with Crisp White Text
        preset_frame = ctk.CTkFrame(left_col, fg_color="transparent")
        preset_frame.pack(fill="x", padx=16, pady=(3, 6))

        presets = [
            ("Today (අද | இன்று)", "TODAY"),
            ("Tomorrow (හෙට | நாளை)", "TOMORROW"),
            ("3 Days (දින 3 | 3 நாள்)", "NEXT_3"),
            ("7 Days (දින 7 | 7 நாள்)", "NEXT_7"),
        ]
        self.preset_buttons = {}
        for title, key in presets:
            btn = ctk.CTkButton(
                preset_frame,
                text=title,
                font=(FONT_FAMILY, 11, "bold"),
                text_color="#FFFFFF",
                height=32,
                fg_color=COLORS["btn_primary"] if key == "TODAY" else COLORS["btn_dark"],
                hover_color=COLORS["btn_primary_hover"],
                command=lambda k=key: self._apply_date_preset(k),
            )
            btn.pack(side="left", fill="x", expand=True, padx=(0, 4))
            self.preset_buttons[key] = btn

        # Date Pickers Row (From Date <-> To Date)
        picker_frame = ctk.CTkFrame(left_col, fg_color=COLORS["input_bg"], corner_radius=12)
        picker_frame.pack(fill="x", padx=16, pady=(0, 6), ipady=4)

        # From Date Box
        from_box = ctk.CTkFrame(picker_frame, fg_color="transparent")
        from_box.pack(side="left", padx=8, pady=2, expand=True)

        ctk.CTkLabel(
            from_box, text=get_text("from_date"), font=(FONT_FAMILY, 11, "bold"), text_color=COLORS["text_muted"]
        ).pack(anchor="w")

        from_ctrl = ctk.CTkFrame(from_box, fg_color="transparent")
        from_ctrl.pack(anchor="w", pady=1)

        ctk.CTkButton(
            from_ctrl, text="◀", width=32, height=32, font=(FONT_FAMILY, 13, "bold"),
            text_color="#FFFFFF", fg_color=COLORS["btn_dark"], hover_color=COLORS["btn_primary_hover"],
            command=lambda: self._adjust_date("START", -1)
        ).pack(side="left", padx=2)

        self.from_label = ctk.CTkLabel(
            from_ctrl, text=self.start_date.strftime("%Y-%m-%d"), font=(FONT_FAMILY, 14, "bold"), width=100, text_color=COLORS["text_main"]
        )
        self.from_label.pack(side="left", padx=2)

        ctk.CTkButton(
            from_ctrl, text="▶", width=32, height=32, font=(FONT_FAMILY, 13, "bold"),
            text_color="#FFFFFF", fg_color=COLORS["btn_dark"], hover_color=COLORS["btn_primary_hover"],
            command=lambda: self._adjust_date("START", 1)
        ).pack(side="left", padx=2)

        # Arrow Separator
        ctk.CTkLabel(picker_frame, text="➔", font=(FONT_FAMILY, 16, "bold"), text_color="#60A5FA").pack(side="left", padx=2)

        # To Date Box
        to_box = ctk.CTkFrame(picker_frame, fg_color="transparent")
        to_box.pack(side="left", padx=8, pady=2, expand=True)

        ctk.CTkLabel(
            to_box, text=get_text("to_date"), font=(FONT_FAMILY, 11, "bold"), text_color=COLORS["text_muted"]
        ).pack(anchor="w")

        to_ctrl = ctk.CTkFrame(to_box, fg_color="transparent")
        to_ctrl.pack(anchor="w", pady=1)

        ctk.CTkButton(
            to_ctrl, text="◀", width=32, height=32, font=(FONT_FAMILY, 13, "bold"),
            text_color="#FFFFFF", fg_color=COLORS["btn_dark"], hover_color=COLORS["btn_primary_hover"],
            command=lambda: self._adjust_date("END", -1)
        ).pack(side="left", padx=2)

        self.to_label = ctk.CTkLabel(
            to_ctrl, text=self.end_date.strftime("%Y-%m-%d"), font=(FONT_FAMILY, 14, "bold"), width=100, text_color=COLORS["text_main"]
        )
        self.to_label.pack(side="left", padx=2)

        ctk.CTkButton(
            to_ctrl, text="▶", width=32, height=32, font=(FONT_FAMILY, 13, "bold"),
            text_color="#FFFFFF", fg_color=COLORS["btn_dark"], hover_color=COLORS["btn_primary_hover"],
            command=lambda: self._adjust_date("END", 1)
        ).pack(side="left", padx=2)

        # Days Duration Tag
        self.duration_badge = ctk.CTkLabel(
            picker_frame,
            text="Duration: 1 Day (දින 1 | 1 நாள்)",
            font=(FONT_FAMILY, 11, "bold"),
            text_color="#60A5FA",
            fg_color=COLORS["card_bg"],
            corner_radius=8,
            padx=10,
            pady=4,
            wraplength=180,
        )
        self.duration_badge.pack(side="right", padx=10)

        # Existing Allocations Alert Banner for Selected Date Range
        self.alert_banner = ctk.CTkFrame(left_col, fg_color="transparent", corner_radius=10)
        self.alert_banner.pack(fill="x", padx=16, pady=(0, 4))
        self.alert_label = ctk.CTkLabel(
            self.alert_banner,
            text="",
            font=(FONT_FAMILY, 11),
            wraplength=520,
            justify="left"
        )
        self.alert_label.pack(padx=8, pady=3, anchor="w")

        # 2. Section: Meal Portion Counters & Cutoff Enforcements
        meal_header_row = ctk.CTkFrame(left_col, fg_color="transparent")
        meal_header_row.pack(fill="x", padx=16, pady=(3, 4))

        ctk.CTkLabel(
            meal_header_row,
            text=get_text("section_2_meals"),
            font=(FONT_FAMILY, 14, "bold"),
            text_color=COLORS["text_main"],
        ).pack(side="left")

        ctk.CTkLabel(
            meal_header_row,
            text="Cutoffs: Breakfast 09:00 AM | Lunch 11:00 AM | Dinner 04:00 PM",
            font=(FONT_FAMILY, 10, "bold"),
            text_color=COLORS["accent_yellow"],
            wraplength=340,
        ).pack(side="right")

        self.meals_container = ctk.CTkFrame(left_col, fg_color="transparent")
        self.meals_container.pack(fill="x", padx=16, pady=0)

        # Meal Cards
        self.meal_cards = {}
        self._build_all_meal_portion_cards()

        # 3. Section: Order Calculation & Submit Bar
        calc_bar = ctk.CTkFrame(left_col, fg_color=COLORS["input_bg"], corner_radius=12)
        calc_bar.pack(fill="x", padx=16, pady=(8, 6), ipady=3)

        self.summary_calc_label = ctk.CTkLabel(
            calc_bar,
            text="Calculating order summary...",
            font=(FONT_FAMILY, 12, "bold"),
            text_color=COLORS["text_main"],
            wraplength=480,
            justify="left",
        )
        self.summary_calc_label.pack(side="left", padx=12)

        self.submit_btn = ctk.CTkButton(
            left_col,
            text="CONFIRM & PLACE MEAL ORDER  (ඇණවුම තහවුරු කරන්න | உணவை உறுதிப்படுத்து)  ➔",
            font=(FONT_FAMILY, 15, "bold"),
            text_color="#FFFFFF",
            height=46,
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            command=self._submit_order,
        )
        self.submit_btn.pack(fill="x", padx=16, pady=(0, 10))

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
        right_col.grid(row=0, column=1, sticky="nsew", padx=(8, 0), pady=0)

        # Profile Card
        profile_card = ctk.CTkFrame(right_col, fg_color=COLORS["input_bg"], corner_radius=12)
        profile_card.pack(fill="x", padx=12, pady=10, ipady=4)

        emp_name = (
            employee.get("name")
            or employee.get("full_name")
            or f"{employee.get('first_name', '')} {employee.get('last_name', '')}".strip()
            or f"Employee {emp_id}"
        )
        emp_dept = employee.get("department") or employee.get("section") or employee.get("designation") or "Operations"
        emp_cat = employee.get("pay_category") or employee.get("category_employment") or "Staff"

        ctk.CTkLabel(profile_card, text="👤", font=(FONT_FAMILY, 32)).pack(pady=(2, 0))
        ctk.CTkLabel(
            profile_card, text=emp_name, font=(FONT_FAMILY, 15, "bold"), text_color=COLORS["text_main"], wraplength=260
        ).pack()
        ctk.CTkLabel(
            profile_card, text=f"ID: {emp_id}  |  {emp_dept}", font=(FONT_FAMILY, 12, "bold"), text_color="#60A5FA", wraplength=260
        ).pack(pady=1)
        ctk.CTkLabel(
            profile_card, text=f"Category: {emp_cat}  |  කාණ්ඩය  |  பிரிவு", font=(FONT_FAMILY, 11), text_color=COLORS["text_muted"], wraplength=260
        ).pack()

        # Admin Override Checkbox (Visible ONLY for Emp ID 641)
        if is_admin_user:
            admin_box = ctk.CTkFrame(profile_card, fg_color="transparent")
            admin_box.pack(pady=(3, 0))
            self.override_chk = ctk.CTkCheckBox(
                admin_box,
                text="Admin Override (Bypass Cutoffs for 641)  |  පරිපාලක",
                font=(FONT_FAMILY, 10, "bold"),
                text_color="#60a5fa",
                command=self._on_admin_override_toggle,
            )
            self.override_chk.pack()

        # Upcoming Allocations Header with Live Cloud Status Badge
        alloc_header = ctk.CTkFrame(right_col, fg_color="transparent")
        alloc_header.pack(fill="x", padx=12, pady=(3, 2))
        ctk.CTkLabel(
            alloc_header, text="📋 Upcoming 7 Days  |  දින 7 කෑම", font=(FONT_FAMILY, 12, "bold"), text_color=COLORS["text_main"], wraplength=200
        ).pack(side="left")

        self.alloc_status_badge = ctk.CTkLabel(
            alloc_header,
            text="⏳ Syncing...",
            font=(FONT_FAMILY, 10, "bold"),
            text_color="#60A5FA",
            fg_color="#1e293b",
            corner_radius=6,
            padx=6,
            pady=2,
        )
        self.alloc_status_badge.pack(side="right")

        # Scrollable Allocations List
        self.alloc_scroll = ctk.CTkScrollableFrame(right_col, fg_color="transparent", height=260)
        self.alloc_scroll.pack(fill="both", expand=True, padx=12, pady=(0, 6))

        # Show initial animated loading state inside allocations list
        self._render_upcoming_allocations_loading()

        # Logout / Exit Button with Live Countdown
        self.logout_btn = ctk.CTkButton(
            right_col,
            text=f"Cancel / Exit (අවලංගු කරන්න | வெளியேறு) ({self.countdown_remaining}s)",
            font=(FONT_FAMILY, 12, "bold"),
            text_color="#FFFFFF",
            fg_color=COLORS["btn_dark"],
            hover_color=COLORS["accent_red"],
            height=38,
            command=self.show_standby_screen,
        )
        self.logout_btn.pack(fill="x", padx=12, pady=(0, 10))

        # Check existing allocations and fetch upcoming bookings asynchronously
        self._check_existing_allocations_for_range()
        self._fetch_upcoming_allocations(emp_id)
        self._update_order_calculation()

        # Run countdown
        self._run_countdown()

    def _on_admin_override_toggle(self):
        self.admin_override = self.override_chk.get() == 1 if hasattr(self, "override_chk") else False
        self._build_all_meal_portion_cards()
        self._update_order_calculation()

    # -------------------------------------------------------------
    # BUILD MEAL PORTION CARDS WITH CUTOFF STATE
    # -------------------------------------------------------------
    def _build_all_meal_portion_cards(self):
        for w in self.meals_container.winfo_children():
            w.destroy()

        # Breakfast Card
        self._build_meal_portion_card(
            meal_name="Breakfast",
            sinhala_text="උදෑසන • காலை",
            icon="☕",
            accent_color="#f59e0b",
            attr_name="breakfast",
        )

        # Lunch Card
        self._build_meal_portion_card(
            meal_name="Lunch",
            sinhala_text="දිවා ආහාරය • மதிய உணவு",
            icon="🍲",
            accent_color="#10b981",
            attr_name="lunch",
        )

        # Dinner Card
        self._build_meal_portion_card(
            meal_name="Dinner",
            sinhala_text="රාත්‍රී ආහාරය • இரவு உணவு",
            icon="🍽️",
            accent_color="#ef4444",
            attr_name="dinner",
        )

    def _build_meal_portion_card(self, meal_name, sinhala_text, icon, accent_color, attr_name):
        is_closed, cutoff_msg, cutoff_display = check_ordering_cutoff(meal_name, self.start_date, self.admin_override)

        card = ctk.CTkFrame(
            self.meals_container,
            fg_color=COLORS["input_bg"] if not is_closed else "#18141c",
            corner_radius=12,
            border_width=1,
            border_color=COLORS["card_border"] if not is_closed else "#7f1d1d",
        )
        card.pack(fill="x", pady=2)

        if is_closed and not self.admin_override:
            setattr(self, f"{attr_name}_qty", 0)

        current_val = getattr(self, f"{attr_name}_qty", 0)

        # Left Column: Info & Status
        left_info = ctk.CTkFrame(card, fg_color="transparent")
        left_info.pack(side="left", padx=10, pady=4)

        title_row = ctk.CTkFrame(left_info, fg_color="transparent")
        title_row.pack(anchor="w")

        ctk.CTkLabel(title_row, text=icon, font=(FONT_FAMILY, 22)).pack(side="left", padx=(0, 6))
        ctk.CTkLabel(
            title_row,
            text=f"{meal_name}  ({sinhala_text})",
            font=(FONT_FAMILY, 14, "bold"),
            text_color=COLORS["text_main"] if not is_closed else "#9ca3af",
        ).pack(side="left")

        status_color = "#34d399" if not is_closed else "#f87171"
        ctk.CTkLabel(
            left_info,
            text=cutoff_msg,
            font=(FONT_FAMILY, 10),
            text_color=status_color,
            wraplength=300,
            justify="left",
        ).pack(anchor="w", pady=(1, 0))

        # Right Column: Counter Buttons in Dark Navy Blue with White Text
        ctrl_box = ctk.CTkFrame(card, fg_color="transparent")
        ctrl_box.pack(side="right", padx=10, pady=4)

        minus_btn = ctk.CTkButton(
            ctrl_box,
            text="−",
            font=(FONT_FAMILY, 15, "bold"),
            text_color="#FFFFFF",
            width=34,
            height=34,
            fg_color=COLORS["btn_dark"] if not is_closed else "#27272a",
            hover_color=COLORS["btn_dark_hover"],
            state="normal" if not is_closed else "disabled",
            command=lambda: self._adjust_meal_qty(attr_name, -1),
        )
        minus_btn.pack(side="left", padx=2)

        val_label = ctk.CTkLabel(
            ctrl_box,
            text=str(current_val),
            font=(FONT_FAMILY, 15, "bold"),
            width=28,
            text_color=COLORS["text_main"] if not is_closed else "#6b7280",
        )
        val_label.pack(side="left", padx=2)
        setattr(self, f"{attr_name}_label", val_label)

        plus_btn = ctk.CTkButton(
            ctrl_box,
            text="+",
            font=(FONT_FAMILY, 15, "bold"),
            text_color="#FFFFFF",
            width=34,
            height=34,
            fg_color=COLORS["btn_primary"] if not is_closed else "#27272a",
            hover_color=COLORS["btn_primary_hover"],
            state="normal" if not is_closed else "disabled",
            command=lambda: self._adjust_meal_qty(attr_name, 1),
        )
        plus_btn.pack(side="left", padx=2)

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
        if hasattr(self, "summary_calc_label") and self.summary_calc_label.winfo_exists():
            self.summary_calc_label.configure(text=calc_text)

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

        for k, btn in self.preset_buttons.items():
            btn.configure(fg_color=COLORS["btn_primary"] if k == preset_key else COLORS["btn_dark"])

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

        for btn in self.preset_buttons.values():
            btn.configure(fg_color=COLORS["btn_dark"])

        self._refresh_date_display()

    def _refresh_date_display(self):
        if hasattr(self, "from_label") and self.from_label.winfo_exists():
            self.from_label.configure(text=self.start_date.strftime("%Y-%m-%d"))
        if hasattr(self, "to_label") and self.to_label.winfo_exists():
            self.to_label.configure(text=self.end_date.strftime("%Y-%m-%d"))

        total_days = (self.end_date - self.start_date).days + 1
        if hasattr(self, "duration_badge") and self.duration_badge.winfo_exists():
            self.duration_badge.configure(text=f"Duration: {total_days} Day(s) (දින {total_days} | {total_days} நாட்கள்)")

        self._build_all_meal_portion_cards()
        self._check_existing_allocations_for_range()
        self._update_order_calculation()

    # -------------------------------------------------------------
    # EXISTING ALLOCATIONS & UPCOMING BOOKINGS BACKGROUND FETCH
    # -------------------------------------------------------------
    def _render_upcoming_allocations_loading(self):
        """Display an animated loading spinner card inside the upfront bookings list"""
        if not hasattr(self, "alloc_scroll") or not self.alloc_scroll.winfo_exists():
            return

        for w in self.alloc_scroll.winfo_children():
            w.destroy()

        loading_box = ctk.CTkFrame(self.alloc_scroll, fg_color=COLORS["input_bg"], corner_radius=12)
        loading_box.pack(fill="x", padx=4, pady=20, ipady=6)

        ctk.CTkLabel(
            loading_box,
            text="⏳ Fetching Upfront Meal Bookings...",
            font=(FONT_FAMILY, 12, "bold"),
            text_color="#60A5FA"
        ).pack(pady=(6, 3))

        pbar = ctk.CTkProgressBar(
            loading_box,
            mode="indeterminate",
            height=4,
            corner_radius=2,
            fg_color="#0F172A",
            progress_color="#3B82F6",
        )
        pbar.pack(fill="x", padx=20, pady=(2, 4))
        pbar.start()

        ctk.CTkLabel(
            loading_box,
            text="කෑම වෙන්කිරීම් පරීක්ෂා කරමින් පවතී  |  முன்பதிவுகள் சரிபார்க்கப்படுகின்றன...",
            font=(FONT_FAMILY, 10, "bold"),
            text_color=COLORS["text_muted"],
            wraplength=220,
            justify="center",
        ).pack(pady=(0, 4))

        self._render_alloc_pbar = pbar

    def _fetch_upcoming_allocations(self, emp_id):
        if hasattr(self, "alloc_status_badge") and self.alloc_status_badge.winfo_exists():
            self.alloc_status_badge.configure(text="⏳ Syncing...", text_color="#60A5FA", fg_color="#1e293b")

        def on_alloc_done(ok, res):
            if ok:
                self.upcoming_allocations = res.get("data", [])
                self.after(0, self._render_upcoming_allocations_list)
                # Instantly refresh date range alert with fresh data
                self.after(0, self._check_existing_allocations_for_range)
                if hasattr(self, "alloc_status_badge") and self.alloc_status_badge.winfo_exists():
                    cnt = len(self.upcoming_allocations)
                    badge_txt = f"● {cnt} Booked" if cnt > 0 else "● No Bookings"
                    badge_col = "#10B981" if cnt > 0 else COLORS["text_muted"]
                    self.after(0, lambda: self.alloc_status_badge.configure(text=badge_txt, text_color=badge_col))
            else:
                self.after(0, self._render_upcoming_allocations_list)
                if hasattr(self, "alloc_status_badge") and self.alloc_status_badge.winfo_exists():
                    self.after(0, lambda: self.alloc_status_badge.configure(text="● Offline Cache", text_color=COLORS["accent_yellow"]))

        self.api.get_employee_orders_async(emp_id, days=7, callback=on_alloc_done)

    def _check_existing_allocations_for_range(self):
        if not self.current_employee:
            return

        emp_id = self.current_employee.get("emp_id")
        start_str = self.start_date.strftime("%Y-%m-%d")
        end_str = self.end_date.strftime("%Y-%m-%d")
        self.allocation_check_token += 1
        current_token = self.allocation_check_token

        # 0ms Instant In-Memory Pre-Evaluation if upcoming allocations are already loaded
        if self.upcoming_allocations:
            in_range = [
                a for a in self.upcoming_allocations
                if a.get("date") and start_str <= a.get("date") <= end_str
            ]
            self._render_existing_alert(len(in_range) > 0, in_range, start_str, end_str)
        else:
            # Show subtle verifying banner while initial fetch resolves
            if hasattr(self, "alert_banner") and self.alert_banner.winfo_exists():
                self.alert_banner.configure(fg_color="#1e293b", border_width=1, border_color="#3b82f6")
                self.alert_label.configure(
                    text="⏳ Verifying date range availability with Cloud...  |  පරීක්ෂා කෙරේ...",
                    text_color="#60A5FA"
                )

        def on_check_done(ok, res, token):
            if token != self.allocation_check_token:
                return  # Discard outdated response from rapid date toggling
            if ok:
                has_existing = res.get("hasExisting", False)
                allocs = res.get("allocations", [])
                self.after(0, lambda: self._render_existing_alert(has_existing, allocs, start_str, end_str))

        self.api.check_allocations_async(emp_id, start_str, end_str, callback=on_check_done, request_token=current_token)

    def _render_existing_alert(self, has_existing, allocs, start_str, end_str):
        if not hasattr(self, "alert_banner") or not self.alert_banner.winfo_exists():
            return

        if has_existing and len(allocs) > 0:
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
                text=f"ℹ️ Notice: Meals already booked in this range ({breakdown_str}). Duplicate entries prevented.\nමෙම දින පරාසය තුළ කෑම වෙන්කර ඇත. නැවත වෙන්කිරීම් වැළැක්වේ.",
                text_color="#fbbf24",
            )
        else:
            self.alert_banner.configure(fg_color="#064e3b", border_width=1, border_color="#10b981")
            self.alert_label.configure(
                text="✅ Selected date range is clear. No conflicting meal allocations found.\nතෝරාගත් දින පරාසය තුළ ගැටුම් නොමැත.",
                text_color="#34d399",
            )

    def _render_upcoming_allocations_list(self):
        if not hasattr(self, "alloc_scroll") or not self.alloc_scroll.winfo_exists():
            return

        for w in self.alloc_scroll.winfo_children():
            w.destroy()

        if not self.upcoming_allocations:
            ctk.CTkLabel(
                self.alloc_scroll,
                text="No existing meal bookings found for the next 7 days.\nඉදිරි දින 7 සඳහා කෑම වෙන්කිරීම් නොමැත.\nஅடுத்த 7 நாட்களுக்கு முன்பதிவுகள் இல்லை.",
                font=(FONT_FAMILY, 11, "bold"),
                text_color=COLORS["text_muted"],
                justify="center",
                wraplength=240,
            ).pack(pady=16)
            return

        for alloc in self.upcoming_allocations:
            item = ctk.CTkFrame(self.alloc_scroll, fg_color=COLORS["input_bg"], corner_radius=10)
            item.pack(fill="x", pady=3)

            left_box = ctk.CTkFrame(item, fg_color="transparent")
            left_box.pack(side="left", padx=10, pady=6)

            ctk.CTkLabel(
                left_box, text=alloc.get("date", ""), font=(FONT_FAMILY, 12, "bold"), text_color=COLORS["text_main"]
            ).pack(anchor="w")

            meal_type = alloc.get("meal_type", "Meal")
            sinhala_meal = "උදෑසන • காலை" if meal_type == "Breakfast" else ("දිවා ආහාරය • மதிய உணவு" if meal_type == "Lunch" else "රාත්‍රී ආහාරය • இரவு உணவு")
            meal_color = "#f59e0b" if meal_type == "Breakfast" else ("#10b981" if meal_type == "Lunch" else "#ef4444")

            ctk.CTkLabel(
                left_box, text=f"{meal_type} (Qty: {alloc.get('quantity', 1)})  |  {sinhala_meal}", font=(FONT_FAMILY, 11, "bold"), text_color=meal_color, wraplength=170, justify="left"
            ).pack(anchor="w")

            status = alloc.get("status", "Ordered")
            tag_color = COLORS["accent_green"] if status == "Received" or alloc.get("received") else "#60A5FA"
            tag_text = "🍲 Received\n(ලබාගෙන ඇත)" if status == "Received" or alloc.get("received") else "🟢 Ordered\n(වෙන්කර ඇත)"

            ctk.CTkLabel(
                item, text=tag_text, font=(FONT_FAMILY, 10, "bold"), text_color=tag_color, justify="center"
            ).pack(side="right", padx=8)

    # -------------------------------------------------------------
    # SUBMIT ORDER TO CLOUD FUNCTIONS
    # -------------------------------------------------------------
    def _submit_order(self):
        if self.breakfast_qty == 0 and self.lunch_qty == 0 and self.dinner_qty == 0:
            play_warning_beep()
            return

        self.submit_btn.configure(
            text="⏳ Submitting Order to Cloud Functions...  |  ඇණවුම යවමින් පවතී...",
            font=(FONT_FAMILY, 13, "bold"),
            state="disabled",
            fg_color="#1e3a8a",
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

        def on_order_done(ok, res):
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

        self.api.place_meal_order_async(
            emp_id=emp_id,
            emp_name=emp_name,
            start_date=start_str,
            end_date=end_str,
            breakfast=self.breakfast_qty,
            lunch=self.lunch_qty,
            dinner=self.dinner_qty,
            department=emp_dept,
            pay_category=emp_cat,
            callback=on_order_done
        )

    def _show_order_success(self, res, start_str, end_str):
        for widget in self.main_container.winfo_children():
            widget.destroy()

        success_card = ctk.CTkFrame(
            self.main_container,
            fg_color=COLORS["card_bg"],
            corner_radius=20,
            border_width=2,
            border_color="#3B82F6",
        )
        success_card.place(relx=0.5, rely=0.5, anchor="center", relwidth=0.86, relheight=0.82)

        created_count = res.get("createdCount", 0)

        if created_count > 0:
            icon_char = "✅"
            title_text = "MEAL ORDER PROCESSED!"
            title_color = "#60A5FA"
            sinhala_text = "ආහාර ඇණවුම සාර්ථකව පද්ධතියට එක් කරන ලදී  |  ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது"
            status_text = f"Status: {created_count} new meal allocation(s) confirmed."
        else:
            icon_char = "ℹ️"
            title_text = "MEALS ALREADY BOOKED"
            title_color = COLORS["accent_yellow"]
            sinhala_text = "මෙම දිනයන් සඳහා ආහාර දැනටමත් වෙන්කර ඇත  |  ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது"
            status_text = "Status: Meals have already been booked for this date range."

        ctk.CTkLabel(success_card, text=icon_char, font=(FONT_FAMILY, 48)).pack(pady=(18, 2))
        ctk.CTkLabel(
            success_card,
            text=title_text,
            font=(FONT_FAMILY, 20, "bold"),
            text_color=title_color,
        ).pack(pady=(0, 2))
        ctk.CTkLabel(
            success_card,
            text=sinhala_text,
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_main"],
            wraplength=600,
            justify="center",
        ).pack(pady=(0, 8))

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
        info_box.pack(fill="x", padx=36, pady=8, ipady=6)

        ctk.CTkLabel(
            info_box,
            text=summary_text,
            font=(FONT_FAMILY, 13, "bold"),
            text_color=COLORS["text_main"],
            justify="center",
        ).pack()

        # Done Button in Dark Navy Blue with White Text
        ctk.CTkButton(
            success_card,
            text="Done / Back to Home (ආපසු මුල් පිටුවට | முடிந்தது)",
            font=(FONT_FAMILY, 13, "bold"),
            text_color="#FFFFFF",
            fg_color=COLORS["btn_primary"],
            hover_color=COLORS["btn_primary_hover"],
            height=42,
            command=self.show_standby_screen,
        ).pack(pady=(10, 0))

        self.after(6000, self.show_standby_screen)

    def _show_order_failed(self, error_msg):
        self.submit_btn.configure(
            text="CONFIRM & PLACE MEAL ORDER  ➔",
            font=(FONT_FAMILY, 15, "bold"),
            state="normal",
            fg_color=COLORS["btn_primary"],
            text_color="#FFFFFF",
        )
        error_dialog = ctk.CTkLabel(
            self.main_container,
            text=f"⚠️ {error_msg}",
            font=(FONT_FAMILY, 13, "bold"),
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
                text=f"Cancel / Exit (අවලංගු කරන්න | வெளியேறு) ({self.countdown_remaining}s)"
            )
        self.after(1000, self._run_countdown)


def main():
    app = OrderingKioskApp()
    app.mainloop()


if __name__ == "__main__":
    main()
