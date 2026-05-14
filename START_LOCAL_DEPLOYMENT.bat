@echo off
REM ════════════════════════════════════════════════════════════════════════════
REM   AHP 2.0 LOCAL DEPLOYMENT QUICK START (Windows)
REM ════════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║         AHP 2.0 LOCAL DEPLOYMENT - QUICK START                ║
echo ║              Using Mock Backend (Node.js)                      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Get the root directory
set ROOT_DIR=%~dp0

echo [SETUP] Installing dependencies...
echo.

REM Install patient-app dependencies
echo Installing patient-app dependencies...
cd "%ROOT_DIR%patient-app"
call npm install --legacy-peer-deps > nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to install patient-app dependencies
    goto error
)
echo ✓ Patient app dependencies installed

REM Install doctor-app dependencies  
echo Installing doctor-app dependencies...
cd "%ROOT_DIR%doctor-app"
call npm install --legacy-peer-deps > nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to install doctor-app dependencies
    goto error
)
echo ✓ Doctor app dependencies installed

cd "%ROOT_DIR%"

REM Create a batch file to start all services
echo.
echo [START] Launching services...
echo.

REM Start mock backend in new window
echo Starting Mock Backend on port 8000...
start "Mock Backend" cmd /k "node mock_backend.js"
timeout /t 2 > nul

REM Start patient app in new window
echo Starting Patient App on port 19006...
start "Patient App" cmd /k "cd patient-app && npm run web"
timeout /t 2 > nul

REM Start doctor app in new window
echo Starting Doctor App on port 3000...
start "Doctor App" cmd /k "cd doctor-app && npm run start"

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    SERVICES STARTED!                          ║
echo ╠════════════════════════════════════════════════════════════════╣
echo ║  Mock Backend:    http://localhost:8000                       ║
echo ║  Doctor App:      http://localhost:3000                       ║
echo ║  Patient App:     http://localhost:19006                      ║
echo ╠════════════════════════════════════════════════════════════════╣
echo ║  TEST CREDENTIALS:                                            ║
echo ║  AHP-ID: AHP-123456-XYZ                                       ║
echo ║  Password: any (mock backend allows any password)             ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Close any window to stop that service. Close all to shut down.
echo.

timeout /t 30

goto end

:error
echo.
echo ERROR: Deployment failed. Check the errors above.
echo.
goto end

:end
