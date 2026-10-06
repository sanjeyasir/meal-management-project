@echo off
title Hayleys Kiosk Station - Auto-Restart Watchdog
color 0F

:: ==========================================================
:: Hayleys Eco Solutions - Kiosk Auto-Restart Watchdog Script
:: Supports both Ordering Kiosk and Receiving Kiosk in ONE file
:: ==========================================================

set "APP_DIR=C:\Users\POS\Downloads"

:: Check if command line argument was passed (e.g. "ordering" or "receiving")
if /i "%1"=="ordering" goto start_ordering
if /i "%1"=="receiving" goto start_receiving
if /i "%1"=="1" goto start_ordering
if /i "%1"=="2" goto start_receiving

:menu
cls
echo =======================================================
echo   HAYLEYS ECO SOLUTIONS - KIOSK WATCHDOG LAUNCHER
echo =======================================================
echo App Directory: %APP_DIR%
echo.
echo Select which Kiosk mode to run on this station:
echo.
echo   [1] Ordering Kiosk   (Ordering-Kiosk.exe)
echo   [2] Receiving Kiosk  (Receiving-Kiosk.exe)
echo   [3] Exit
echo.
set /p choice="Enter option [1, 2, or 3]: "

if "%choice%"=="1" goto start_ordering
if "%choice%"=="2" goto start_receiving
if "%choice%"=="3" exit /b 0
echo Invalid choice. Try again.
timeout /t 2 >nul
goto menu

:: ==========================================================
:: SECTION 1: ORDERING KIOSK WATCHDOG
:: ==========================================================
:start_ordering
cls
color 0A
set "EXE_NAME=Ordering-Kiosk.exe"
title Hayleys Ordering Kiosk - Watchdog Active

echo =======================================================
echo   ORDERING KIOSK WATCHDOG ACTIVE
echo =======================================================
echo Target: %APP_DIR%\%EXE_NAME%
echo.
echo Watchdog is monitoring %EXE_NAME%.
echo If the kiosk is mistakenly closed or crashes,
echo it will automatically restart in 3 seconds.
echo =======================================================
echo.

:ordering_loop
if not exist "%APP_DIR%" (
    echo [%TIME%] [ERROR] Folder "%APP_DIR%" not found. Retrying in 5s...
    timeout /t 5 /nobreak >nul
    goto ordering_loop
)

cd /d "%APP_DIR%"

if not exist "%EXE_NAME%" (
    echo [%TIME%] [ERROR] "%EXE_NAME%" not found in "%APP_DIR%"!
    echo Retrying in 5s...
    timeout /t 5 /nobreak >nul
    goto ordering_loop
)

echo [%TIME%] Starting %EXE_NAME%...
start /wait "" "%APP_DIR%\%EXE_NAME%"

echo.
echo [%TIME%] [ALERT] %EXE_NAME% was closed or terminated!
echo [%TIME%] Restarting automatically in 3 seconds...
timeout /t 3 /nobreak >nul
goto ordering_loop

:: ==========================================================
:: SECTION 2: RECEIVING KIOSK WATCHDOG
:: ==========================================================
:start_receiving
cls
color 0B
set "EXE_NAME=Receiving-Kiosk.exe"
title Hayleys Receiving Kiosk - Watchdog Active

echo =======================================================
echo   RECEIVING KIOSK WATCHDOG ACTIVE
echo =======================================================
echo Target: %APP_DIR%\%EXE_NAME%
echo.
echo Watchdog is monitoring %EXE_NAME%.
echo If the kiosk is mistakenly closed or crashes,
echo it will automatically restart in 3 seconds.
echo =======================================================
echo.

:receiving_loop
if not exist "%APP_DIR%" (
    echo [%TIME%] [ERROR] Folder "%APP_DIR%" not found. Retrying in 5s...
    timeout /t 5 /nobreak >nul
    goto receiving_loop
)

cd /d "%APP_DIR%"

if not exist "%EXE_NAME%" (
    echo [%TIME%] [ERROR] "%EXE_NAME%" not found in "%APP_DIR%"!
    echo Retrying in 5s...
    timeout /t 5 /nobreak >nul
    goto receiving_loop
)

echo [%TIME%] Starting %EXE_NAME%...
start /wait "" "%APP_DIR%\%EXE_NAME%"

echo.
echo [%TIME%] [ALERT] %EXE_NAME% was closed or terminated!
echo [%TIME%] Restarting automatically in 3 seconds...
timeout /t 3 /nobreak >nul
goto receiving_loop
