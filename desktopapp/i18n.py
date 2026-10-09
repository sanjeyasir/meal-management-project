"""
Trilingual Localization Engine for Hayleys Meal Management Desktop Kiosks
Supports English (en), Sinhala (si), and Tamil (ta)
"""

SUPPORTED_LANGUAGES = ["en", "si", "ta"]

LANGUAGE_NAMES = {
    "en": "🇬🇧 English",
    "si": "🇱🇰 සිංහල",
    "ta": "🇱🇰 தமிழ்"
}

TRANSLATIONS = {
    # -------------------------------------------------------------
    # BRAND & GENERAL
    # -------------------------------------------------------------
    "brand_title": {
        "en": "HAYLEYS ECO SOLUTIONS",
        "si": "හේලීස් ඉකෝ සොලියුෂන්ස්",
        "ta": "ஹெய்லீஸ் ஈகோ சொல்யூஷன்ஸ்"
    },
    "ordering_kiosk_title": {
        "en": "Meal Ordering & Scheduling Kiosk",
        "si": "කෑම ඇණවුම් සහ වෙන්කිරීමේ කියෝස්කය",
        "ta": "உணவு முன்பதிவு கியோஸ்க்"
    },
    "receiving_kiosk_title": {
        "en": "Meal Dispensing & Verification Station",
        "si": "කෑම ලබාගැනීමේ සහ සත්‍යාපන කියෝස්කය",
        "ta": "உணவு விநியோக மற்றும் சரிபார்ப்பு நிலையம்"
    },

    # -------------------------------------------------------------
    # STANDBY & SCANNER
    # -------------------------------------------------------------
    "scan_fingerprint_ordering": {
        "en": "PLEASE SCAN YOUR FINGERPRINT OR ENTER ID",
        "si": "කරුණාකර ඔබගේ ඇඟිලි සලකුණ තබන්න හෝ සේවක අංකය ඇතුළත් කරන්න",
        "ta": "தயவுசெய்து உங்கள் கைரேகையை வைக்கவும் அல்லது ஊழியர் எண்ணை உள்ளிடவும்"
    },
    "scan_fingerprint_receiving": {
        "en": "SCAN FINGERPRINT TO COLLECT MEAL",
        "si": "කෑම ලබාගැනීමට ඇඟිලි සලකුණ තබන්න",
        "ta": "உணவை பெற கைரேகையை வைக்கவும்"
    },
    "scanner_instructions": {
        "en": "Place your registered finger on the optical sensor or enter your ID below.",
        "si": "ආරම්භ කිරීමට ඔබගේ ලියාපදිංචි ඇඟිල්ල ස්කෑනරය මත තබන්න හෝ සේවක අංකය ඇතුළත් කරන්න.",
        "ta": "தொடங்குவதற்கு உங்கள் கைரேகையை வைக்கவும் அல்லது ஊழியர் எண்ணை உள்ளிடவும்."
    },
    "or_enter_pin": {
        "en": "Or enter Employee ID manually:",
        "si": "හෝ සේවක අංකය ඇතුළත් කරන්න:",
        "ta": "அல்லது ஊழியர் எண்ணை உள்ளிடவும்:"
    },
    "pin_placeholder": {
        "en": "Enter Employee ID (e.g. 641)  |  සේවක අංකය  |  ஊழியர் எண்",
        "si": "සේවක අංකය (උදා: 641)",
        "ta": "ஊழியர் எண் (எ.கா: 641)"
    },
    "login_btn": {
        "en": "LOGIN / ENTER  |  ඇතුල් වන්න  |  உள்நுழைக  ➔",
        "si": "ඇතුල් වන්න ➔",
        "ta": "உள்நுழைக ➔"
    },
    "identify_btn": {
        "en": "IDENTIFY & COLLECT  |  හඳුනාගෙන ලබාගන්න  |  அடையாளம்  ➔",
        "si": "හඳුනාගෙන ලබාගන්න ➔",
        "ta": "அடையாளம் ➔"
    },

    # -------------------------------------------------------------
    # MEAL CUTOFFS & SERVING HOURS
    # -------------------------------------------------------------
    "canteen_hours_title": {
        "en": "🕒 CANTEEN SERVING HOURS & CUTOFF TIMES",
        "si": "🕒 ආපනශාලා වේලාවන් සහ ඇණවුම් අවසන් වේලාවන්",
        "ta": "🕒 உணவக சேவை மற்றும் முடிவு நேரங்கள்"
    },
    "breakfast_cutoff_desc": {
        "en": "Breakfast Cutoff: 09:00 AM (Serving: 06:00 - 09:00 AM)",
        "si": "උදෑසන ඇණවුම් අවසන් වේලාව: පෙ.ව. 09:00 (ලබාදීම: 06:00 - 09:00)",
        "ta": "காலை உணவு முடிவு: மு.ப. 09:00 (வழங்கல்: 06:00 - 09:00 மு.ப.)"
    },
    "lunch_cutoff_desc": {
        "en": "Lunch Cutoff: 11:00 AM (Serving: 11:00 AM - 02:00 PM)",
        "si": "දවල් ඇණවුම් අවසන් වේලාව: පෙ.ව. 11:00 (ලබාදීම: 11:00 - 02:00)",
        "ta": "மதிய உணவு முடிவு: மு.ப. 11:00 (வழங்கல்: 11:00 மு.ப. - 02:00 பி.ப.)"
    },
    "dinner_cutoff_desc": {
        "en": "Dinner Cutoff: 04:00 PM (Serving: 04:00 PM - 09:30 PM)",
        "si": "රාත්‍රී ඇණවුම් අවසන් වේලාව: ප.ව. 04:00 (ලබාදීම: 04:00 - 09:30)",
        "ta": "இரவு உணவு முடிவு: பி.ப. 04:00 (வழங்கல்: 04:00 - 09:30 பி.ப.)"
    },
    "meal_closed_for_today": {
        "en": "⛔ Cutoff Passed (Closed for Today)",
        "si": "⛔ අද දිනය සඳහා ඇණවුම් අවසන්",
        "ta": "⛔ இன்றைய முன்பதிவு முடிந்தது"
    },
    "cutoff_warning_note": {
        "en": "⚠️ Note: For today's orders, meals must be booked before their respective cutoff times.",
        "si": "⚠️ සටහන: අද දිනයේ ආහාර ලබාගැනීමට නියමිත වේලාවට පෙර ඇණවුම් කළ යුතුය.",
        "ta": "⚠️ குறிப்பு: இன்றைய உணவுக்கு குறிப்பிட்ட நேரத்திற்குள் முன்பதிவு செய்ய வேண்டும்."
    },

    # -------------------------------------------------------------
    # ORDERING SCREEN SECTIONS
    # -------------------------------------------------------------
    "section_1_date_range": {
        "en": "1. Select Scheduling Date Range (දින පරාසය තෝරන්න | தேதி வரம்பு)",
        "si": "1. ඇණවුම් කරන දින පරාසය තෝරන්න",
        "ta": "1. முன்பதிவு தேதி வரம்பைத் தேர்ந்தெடுக்கவும்"
    },
    "preset_today": {
        "en": "Today (අද | இன்று)",
        "si": "අද දිනය",
        "ta": "இன்று"
    },
    "preset_tomorrow": {
        "en": "Tomorrow (හෙට | நாளை)",
        "si": "හෙට දිනය",
        "ta": "நாளை"
    },
    "preset_next_3": {
        "en": "Next 3 Days (දින 3 | 3 நாட்கள்)",
        "si": "ඉදිරි දින 3",
        "ta": "அடுத்த 3 நாட்கள்"
    },
    "preset_next_7": {
        "en": "Next 7 Days (දින 7 | 7 நாட்கள்)",
        "si": "ඉදිරි දින 7",
        "ta": "அடுத்த 7 நாட்கள்"
    },
    "from_date": {
        "en": "📅 From (සිට | தொடக்கம்):",
        "si": "📅 ආරම්භක දිනය:",
        "ta": "📅 தொடக்க தேதி:"
    },
    "to_date": {
        "en": "📅 To (දක්වා | முடிவு):",
        "si": "📅 අවසන් දිනය:",
        "ta": "📅 முடிவு தேதி:"
    },
    "section_2_meals": {
        "en": "2. Select Meal Portions (ආහාර ප්‍රමාණය තෝරන්න | உணவு அளவு)",
        "si": "2. දිනපතා ලබාගන්නා ආහාර ප්‍රමාණය තෝරන්න",
        "ta": "2. தினசரி உணவு அளவைத் தேர்ந்தெடுக்கவும்"
    },
    "breakfast_title": {
        "en": "Breakfast (උදෑසන • காலை)",
        "si": "උදෑසන ආහාරය",
        "ta": "காலை உணவு"
    },
    "lunch_title": {
        "en": "Lunch (දිවා ආහාරය • மதிய உணவு)",
        "si": "දිවා ආහාරය",
        "ta": "மதிய உணவு"
    },
    "dinner_title": {
        "en": "Dinner (රාත්‍රී ආහාරය • இரவு உணவு)",
        "si": "රාත්‍රී ආහාරය",
        "ta": "இரவு உணவு"
    },
    "confirm_order_btn": {
        "en": "CONFIRM & PLACE ORDER  |  ඇණවුම් කරන්න  |  ஆர்டர் செய்க  ➔",
        "si": "ඇණවුම තහවුරු කර ඉදිරිපත් කරන්න",
        "ta": "ஆர்டரை உறுதி செய்து சமர்ப்பிக்கவும்"
    },
    "cancel_exit_btn": {
        "en": "Cancel / Exit (අවලංගු කරන්න | வெளியேறு)",
        "si": "අවලංගු කරන්න / පිටවන්න",
        "ta": "ரத்து / வெளியேறு"
    },
    "upcoming_bookings_header": {
        "en": "📋 Upcoming 7-Day Bookings  |  දින 7 කෑම වෙන්කිරීම්  |  7-நாள் முன்பதிவுகள்",
        "si": "ඉදිරි දින 7 කෑම වෙන්කිරීම්",
        "ta": "அடுத்த 7-நாள் உணவு முன்பதிவுகள்"
    },

    # -------------------------------------------------------------
    # RECEIVING & DISPENSE
    # -------------------------------------------------------------
    "select_ordered_meal": {
        "en": "Select Your Ordered Meal Portion (ලබාගන්නා ආහාරය තෝරන්න | உணவைத் தேர்ந்தெடுக்கவும்):",
        "si": "ලබාගැනීමට අවශ්‍ය අනුමත ආහාරය තෝරන්න:",
        "ta": "உங்கள் முன்பதிவு செய்யப்பட்ட உணவைத் தேர்ந்தெடுக்கவும்:"
    },
    "dispense_now_btn": {
        "en": "COLLECT & DISPENSE MEAL  |  ආහාර ලබාගන්න  |  உணவை பெறுக  ➔",
        "si": "ආහාර ලබාගෙන සත්‍යාපනය කරන්න",
        "ta": "உணவை பெற்று சரிபார்க்கவும்"
    },
    "already_received": {
        "en": "🍲 Already Received (ලබාගෙන ඇත | பெறப்பட்டது)",
        "si": "දැනටමත් ලබාගෙන ඇත",
        "ta": "ஏற்கனவே பெறப்பட்டது"
    },
    "not_ordered": {
        "en": "❌ Not Ordered (ඇණවුම් කර නැත | ஆர்டர் இல்லை)",
        "si": "මෙම ආහාරය ඇණවුම් කර නැත",
        "ta": "இந்த உணவு முன்பதிவு செய்யப்படவில்லை"
    },
    "ready_to_collect": {
        "en": "✅ Ready to Collect (ලබාගැනීමට සූදානම් | பெற தயார்)",
        "si": "ලබාගැනීමට සූදානම්",
        "ta": "பெற தயாராக உள்ளது"
    },
    "outside_window": {
        "en": "⏳ Serving Window Closed (වේලාව අවසන් | நேரம் முடிந்தது)",
        "si": "ආහාර ලබාදෙන වේලාව නොවේ",
        "ta": "சேவை நேரம் முடிந்தது"
    }
}


def get_text(key, lang="en"):
    """Fetch localized text by key and language, fallback to English or key"""
    trans_map = TRANSLATIONS.get(key, {})
    if isinstance(trans_map, dict):
        return trans_map.get(lang, trans_map.get("en", key))
    return str(trans_map)


def get_trilingual(key, separator="  |  "):
    """Return combined trilingual text: English | Sinhala | Tamil"""
    trans_map = TRANSLATIONS.get(key, {})
    if isinstance(trans_map, dict):
        en = trans_map.get("en", "")
        si = trans_map.get("si", "")
        ta = trans_map.get("ta", "")
        parts = [p for p in [en, si, ta] if p]
        return separator.join(parts) if parts else key
    return str(trans_map)

