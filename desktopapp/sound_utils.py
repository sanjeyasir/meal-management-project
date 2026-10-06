"""
Audio feedback utility for kiosk touch and biometric scan confirmations
"""
import sys
import threading

def _beep_thread(freq, duration_ms):
    try:
        if sys.platform == "win32":
            import winsound
            winsound.Beep(freq, duration_ms)
    except Exception:
        pass

def play_success_beep():
    """Double high-pitch affirmative chime"""
    def chime():
        _beep_thread(1200, 100)
        _beep_thread(1800, 160)
    threading.Thread(target=chime, daemon=True).start()

def play_error_beep():
    """Low-pitch alert buzz"""
    def buzz():
        _beep_thread(400, 300)
    threading.Thread(target=buzz, daemon=True).start()

def play_warning_beep():
    """Medium attention tone"""
    def warn():
        _beep_thread(750, 200)
    threading.Thread(target=warn, daemon=True).start()
