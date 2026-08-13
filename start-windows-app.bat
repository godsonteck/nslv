@echo off
title NS Luxury Villa Management System — Native Desktop Launcher
echo ======================================================================
echo  🏰 NS LUXURY VILLA MANAGEMENT SYSTEM — NATIVE WINDOWS LAUNCHER
echo ======================================================================
echo.
echo Starting local system services...

rem Ensure dependencies are built
if not exist "packages\shared\dist" (
    echo Building @nslv/shared...
    call npm run build:shared
)

if not exist "packages\client\dist" (
    echo Building @nslv/client...
    call npm run build:client
)

if not exist "packages\desktop\dist" (
    echo Compiling @nslv/desktop...
    call npm run build:desktop
)

echo Starting Desktop Application...
call npm run dev:desktop

pause
