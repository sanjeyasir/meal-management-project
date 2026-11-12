# Hayleys Eco Solutions - Meal Management System

A centralized, enterprise-grade industrial catering and meal management ecosystem built with React (Vite, Ant Design), Firebase Cloud Functions, Firestore, and Python CustomTkinter Desktop Kiosks embedded with ZKTeco Biometric middleware.

---

## 📖 System Documentation

- **[WORKFLOW_GUIDE.md](file:///d:/firebaselearning/meal-management-project/WORKFLOW_GUIDE.md)**: Complete system workflow, touch kiosk standard operating procedures (SOPs), UI guides, cutoff timetable, and architecture diagrams.
- **[Interactive Kiosk Guides](file:///d:/firebaselearning/meal-management-project/kiosk_workflow_guide.html)**: Interactive dual-kiosk visual guide with instant PNG downloads and print stylesheets.
- **[A1 Meal Ordering Poster (PNG)](file:///d:/firebaselearning/meal-management-project/screenshots/user_workflow_guide.png)**: High-resolution poster for plant meal ordering touchscreens.
- **[A1 Meal Dispensing Poster (PNG)](file:///d:/firebaselearning/meal-management-project/screenshots/receiving_workflow_guide.png)**: High-resolution poster for canteen meal dispensing counters.
- **[Web Portal User Manual (PDF)](file:///d:/firebaselearning/meal-management-project/public/docs/Meal_Management_Web_Portal_User_Manual.pdf)**: Official administrative guide for HR and plant supervisors.

---

## 🖥️ Applications & Components

1. **Desktop Kiosk Applications (`desktopapp/`)**:
   - `Ordering-Kiosk.exe`: Touchscreen ordering station with biometric fingerprint login, single-day selection (Today, Tomorrow, Other Next Day), max 1 portion increments, and same-day cutoff enforcement.
   - `Receiving-Kiosk.exe`: Canteen dispensing station with serving window control, instant verification, and duplicate dispense blocking.
   - Built executables located in [desktopapp/dist/](file:///d:/firebaselearning/meal-management-project/desktopapp/dist/).

2. **Web Management Portal (`src/`)**:
   - Operations dashboard, real-time allocations, previous day allocations with date filter, daily cloud archives, employees roster, and category subsidy matrix.
   - Live in-app documentation available under **"User Guide & Documentation"** (`#/admin/guide`).

3. **Cloud Backend (`functions/`)**:
   - Firebase Cloud Functions API handling employee verification, meal order placement, dispense logging, automated nightly archiving, and report generation.

