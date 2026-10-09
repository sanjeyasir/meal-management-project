"""
Configuration constants for Hayleys Meal Management Desktop Applications
"""

# Firebase Cloud Functions Endpoint URL (Primary Canonical & Fallback URLs)
API_BASE_URL = "https://us-central1-meal-management-project.cloudfunctions.net/api"
FALLBACK_API_URLS = [
    "https://api-u6eitt5vdq-uc.a.run.app",
    "https://api-iv2t7b42ta-uc.a.run.app",
]


# ZKTeco Biometric Middleware Settings
MIDDLEWARE_HOST = "0.0.0.0"
MIDDLEWARE_PORT = 4370
SECONDARY_PORT = 5000

# UI Theme Color Palette (Glassmorphic Slate & Dark Navy Blue)
COLORS = {
    "bg_dark": "#0B132B",
    "card_bg": "#1C2541",
    "card_border": "#3A506B",
    "btn_primary": "#1E3A8A",       # Very dark blue
    "btn_primary_hover": "#2563EB", # Dark blue hover
    "btn_dark": "#172554",          # Deep navy blue
    "btn_dark_hover": "#1E40AF",
    "accent_green": "#10B981",
    "accent_teal": "#14B8A6",
    "accent_blue": "#1E3A8A",
    "accent_red": "#DC2626",
    "accent_yellow": "#F59E0B",
    "text_main": "#FFFFFF",         # Pure crisp white
    "text_muted": "#CBD5E1",
    "input_bg": "#0F172A",
}

# Typography
FONT_FAMILY = "Segoe UI"

# Auto-logout / Reset Timeout (seconds)
ORDERING_TIMEOUT_SEC = 40
RECEIVING_BANNER_SEC = 6

# Ordering Daily Cutoff Times (24-Hour Format: HH:MM)
# For same-day bookings, orders must be placed before these cutoff times
ORDERING_CUTOFFS = {
    "Breakfast": {"hour": 9, "minute": 0, "display": "09:00 AM"},
    "Lunch": {"hour": 11, "minute": 0, "display": "11:00 AM"},
    "Dinner": {"hour": 16, "minute": 0, "display": "04:00 PM"},
}

# Receiving / Dispensing Serving Windows (24-Hour Format)
SERVING_WINDOWS = {
    "Breakfast": {"start_hour": 6, "start_min": 0, "end_hour": 9, "end_min": 0, "display": "06:00 AM - 09:00 AM"},
    "Lunch": {"start_hour": 11, "start_min": 0, "end_hour": 14, "end_min": 0, "display": "11:00 AM - 02:00 PM"},
    "Dinner": {"start_hour": 16, "start_min": 0, "end_hour": 21, "end_min": 30, "display": "04:00 PM - 09:30 PM"},
}

