@echo off
title Hayleys Receiving Kiosk Watchdog & Auto-Restarter
color 0B

:: ==========================================================
:: Configuration: Set the directory where your executables reside
:: ==========================================================
set "APP_DIR=C:\Users\POS\Downloads"
set "EXE_NAME=Receiving-Kiosk.exe"

echo =======================================================
echo   HAYLEYS ECO SOLUTIONS - RECEIVING KIOSK WATCHDOG
echo =======================================================
echo Directory  : %APP_DIR%
echo Executable : %EXE_NAME%
echo.
echo [STATUS] Kiosk Watchdog is active.
echo If the application is mistakenly closed or crashes,
echo it will automatically restart in 3 seconds.
echo.
echo (Close this CMD window to permanently stop the watchdog)
echo =======================================================
echo.

:watchdog_loop
:: Check if application directory exists
if not exist "%APP_DIR%" (
    echo [%TIME%] [ERROR] Folder "%APP_DIR%" not found. Retrying in 5 seconds...
    timeout /t 5 /nobreak >nul
    goto watchdog_loop
)

cd /d "%APP_DIR%"

:: Check if executable exists
if not exist "%EXE_NAME%" (
    echo [%TIME%] [ERROR] "%EXE_NAME%" not found in "%APP_DIR%"!
    echo Please verify the executable file location. Retrying in 5 seconds...
    timeout /t 5 /nobreak >nul
    goto watchdog_loop
)

echo [%TIME%] Launching %EXE_NAME%...
start /wait "" "%APP_DIR%\%EXE_NAME%"

:: When the process exits / is closed, wait 3 seconds and restart
echo.
echo [%TIME%] [ALERT] %EXE_NAME% was closed or terminated!
echo [%TIME%] Restarting automatically in 3 seconds...
timeout /t 3 /nobreak >nul
goto watchdog_loop
