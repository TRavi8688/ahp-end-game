# ════════════════════════════════════════════════════════════════════════════
# AHP 2.0 LOCAL DEPLOYMENT QUICK START (PowerShell)
# ════════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         AHP 2.0 LOCAL DEPLOYMENT - QUICK START                ║" -ForegroundColor Cyan
Write-Host "║              Using Mock Backend (Node.js)                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check Node.js installation
Write-Host "[CHECK] Verifying Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
$npmVersion = npm --version 2>$null

if ($nodeVersion -and $npmVersion) {
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "✓ npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js or npm not found!" -ForegroundColor Red
    Write-Host "  Install from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[SETUP] Installing dependencies...`n" -ForegroundColor Yellow

# Install patient-app dependencies
Write-Host "Installing patient-app dependencies..." -ForegroundColor Cyan
Push-Location "$RootDir\patient-app"
npm install --legacy-peer-deps --silent | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Patient app dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install patient-app dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Install doctor-app dependencies
Write-Host "Installing doctor-app dependencies..." -ForegroundColor Cyan
Push-Location "$RootDir\doctor-app"
npm install --legacy-peer-deps --silent | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Doctor app dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install doctor-app dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "`n[START] Launching services...`n" -ForegroundColor Yellow

# Function to open new PowerShell window and run command
function Start-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory
    )
    Write-Host "Starting $Name..." -ForegroundColor Cyan
    Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkingDirectory'; $Command" -WindowStyle Normal
}

# Start services
Start-Service -Name "Mock Backend" -Command "node mock_backend.js" -WorkingDirectory $RootDir
Start-Sleep -Seconds 2

Start-Service -Name "Patient App" -Command "npm run web" -WorkingDirectory "$RootDir\patient-app"
Start-Sleep -Seconds 2

Start-Service -Name "Doctor App" -Command "npm run start" -WorkingDirectory "$RootDir\doctor-app"

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    SERVICES STARTED!                          ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Mock Backend:    http://localhost:8000                       ║" -ForegroundColor Green
Write-Host "║  Doctor App:      http://localhost:3000                       ║" -ForegroundColor Green
Write-Host "║  Patient App:     http://localhost:19006                      ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  TEST CREDENTIALS:                                            ║" -ForegroundColor Green
Write-Host "║  AHP-ID: AHP-123456-XYZ                                       ║" -ForegroundColor Green
Write-Host "║  Password: Test@123                                           ║" -ForegroundColor Green
Write-Host "║  New User OTP: 000000                                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Close any window to stop that service.`n" -ForegroundColor Yellow
