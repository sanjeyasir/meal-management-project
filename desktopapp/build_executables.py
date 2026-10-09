"""
Automated PyInstaller Build Script to generate standalone SINGLE-FILE portable executables:
1. Ordering-Kiosk.exe (Single portable .exe)
2. Receiving-Kiosk.exe (Single portable .exe)
"""
import subprocess
import os
import sys

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

def build_single_file_executable(name, entry_point):
    print(f"\n=======================================================")
    print(f"[BUILDING PORTABLE ONE-FILE EXECUTABLE]: {name}.exe")
    print(f"=======================================================")

    dist_dir = os.path.join(BASE_DIR, "dist")
    build_dir = os.path.join(BASE_DIR, "build", name)

    # PyInstaller one-file command with all assets bundled
    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--noconfirm",
        "--onefile", # Single self-contained .exe with embedded python DLL & runtime
        "--windowed", # GUI mode without console window
        "--name", name,
        "--distpath", dist_dir,
        "--workpath", build_dir,
        "--collect-all", "customtkinter",
        "--hidden-import", "desktopapp.config",
        "--hidden-import", "desktopapp.api_client",
        "--hidden-import", "desktopapp.middleware",
        "--hidden-import", "desktopapp.sound_utils",
        "--hidden-import", "desktopapp.i18n",
        "--hidden-import", "requests",
        "--hidden-import", "winsound",
        "--paths", PROJECT_ROOT,
        entry_point
    ]

    print(f"Executing: {' '.join(cmd)}\n")
    res = subprocess.run(cmd, cwd=PROJECT_ROOT)
    if res.returncode != 0:
        print(f"[ERROR]: Failed to build {name}")
        return False
    print(f"[SUCCESS]: Created standalone portable file: {os.path.join(dist_dir, name + '.exe')}")
    return True

if __name__ == "__main__":
    ok_ord = build_single_file_executable("Ordering-Kiosk", os.path.join(BASE_DIR, "ordering_kiosk.py"))
    ok_rec = build_single_file_executable("Receiving-Kiosk", os.path.join(BASE_DIR, "receiving_kiosk.py"))

    if ok_ord and ok_rec:
        print("\n=======================================================")
        print("[SUCCESS] All portable .exe files built successfully!")
        print("Location: desktopapp/dist/Ordering-Kiosk.exe")
        print("Location: desktopapp/dist/Receiving-Kiosk.exe")
        print("=======================================================\n")
    else:
        sys.exit(1)
