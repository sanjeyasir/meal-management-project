"""
Configuration constants for Hayleys Meal Management Desktop Applications
"""

# Firebase Cloud Functions Endpoint URL
API_BASE_URL = "https://api-u6eitt5vdq-uc.a.run.app"

# ZKTeco Biometric Middleware Settings
MIDDLEWARE_HOST = "0.0.0.0"
MIDDLEWARE_PORT = 4370
SECONDARY_PORT = 5000

# UI Theme Color Palette (Glassmorphic Slate & Emerald)
COLORS = {
    "bg_dark": "#0B132B",
    "card_bg": "#1C2541",
    "card_border": "#3A506B",
    "accent_green": "#10B981",
    "accent_teal": "#14B8A6",
    "accent_blue": "#3B82F6",
    "accent_red": "#EF4444",
    "accent_yellow": "#F59E0B",
    "text_main": "#F8FAFC",
    "text_muted": "#94A3B8",
    "input_bg": "#0F172A",
}

# Typography
FONT_FAMILY = "Segoe UI"

# Auto-logout / Reset Timeout (seconds)
ORDERING_TIMEOUT_SEC = 35
RECEIVING_BANNER_SEC = 5
