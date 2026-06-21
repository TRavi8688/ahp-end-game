# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Hospyn — Local Development Launcher
# Run this once to start everything:
#   Auth Service   → http://localhost:8001
#   Healthcare     → http://localhost:8000
#   Frontend       → http://localhost:5180
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$ROOT    = $PSScriptRoot
$REDIS   = "C:\redis-local"
$PYTHON  = "python"

Write-Host ""
Write-Host "  ██╗  ██╗ ██████╗ ███████╗██████╗ ██╗   ██╗███╗   ██╗" -ForegroundColor Cyan
Write-Host "  ██║  ██║██╔═══██╗██╔════╝██╔══██╗╚██╗ ██╔╝████╗  ██║" -ForegroundColor Cyan
Write-Host "  ███████║██║   ██║███████╗██████╔╝ ╚████╔╝ ██╔██╗ ██║" -ForegroundColor Cyan
Write-Host "  ██╔══██║██║   ██║╚════██║██╔═══╝   ╚██╔╝  ██║╚██╗██║" -ForegroundColor Cyan
Write-Host "  ██║  ██║╚██████╔╝███████║██║        ██║   ██║ ╚████║" -ForegroundColor Cyan
Write-Host "  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝        ╚═╝   ╚═╝  ╚═══╝" -ForegroundColor Cyan
Write-Host "  Local Development Stack" -ForegroundColor DarkCyan
Write-Host ""

# ── 1. Start Redis ─────────────────────────────────────────────────────────────
$redisConn = Test-NetConnection localhost -Port 6379 -WarningAction SilentlyContinue
if ($redisConn.TcpTestSucceeded) {
    Write-Host "[Redis]    Already running on :6379" -ForegroundColor Green
} elseif (Test-Path "$REDIS\redis-server.exe") {
    Write-Host "[Redis]    Starting..." -ForegroundColor Yellow
    Start-Process -FilePath "$REDIS\redis-server.exe" -ArgumentList "--port 6379" -WindowStyle Minimized
    Start-Sleep 2
    Write-Host "[Redis]    Started on :6379" -ForegroundColor Green
} else {
    Write-Host "[Redis]    WARNING: redis-server.exe not found at $REDIS" -ForegroundColor Red
    Write-Host "           Run: powershell -File scratch\start_redis.ps1 first" -ForegroundColor Red
}

# ── 2. Check Postgres ──────────────────────────────────────────────────────────
$pgConn = Test-NetConnection localhost -Port 5432 -WarningAction SilentlyContinue
if ($pgConn.TcpTestSucceeded) {
    Write-Host "[Postgres] Already running on :5432" -ForegroundColor Green
} else {
    # Try to start via Windows service
    $pgSvc = Get-Service | Where-Object { $_.Name -like "*postgres*" } | Select-Object -First 1
    if ($pgSvc) {
        Write-Host "[Postgres] Starting service $($pgSvc.Name)..." -ForegroundColor Yellow
        Start-Service $pgSvc.Name
        Start-Sleep 3
        Write-Host "[Postgres] Started on :5432" -ForegroundColor Green
    } elseif (Test-Path "C:\pgsql-local\bin\pg_ctl.exe") {
        Write-Host "[Postgres] Starting from C:\pgsql-local..." -ForegroundColor Yellow
        Start-Process "C:\pgsql-local\bin\pg_ctl.exe" -ArgumentList "start -D `"C:\pgsql-local\data`"" -WindowStyle Minimized
        Start-Sleep 3
        Write-Host "[Postgres] Started on :5432" -ForegroundColor Green
    } else {
        Write-Host "[Postgres] NOT RUNNING — backends will fail to connect" -ForegroundColor Red
        Write-Host "           Install Postgres then re-run this script" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Starting application services..." -ForegroundColor White
Write-Host ""

# ── 3. Auth Service (port 8001) ────────────────────────────────────────────────
Write-Host "[Auth]     Starting on http://localhost:8001 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  `$Host.UI.RawUI.WindowTitle = 'Hospyn Auth Service :8001'
  Set-Location '$ROOT\backend\auth-service'
  `$env:PYTHONPATH = '$ROOT\backend'
  Write-Host 'Auth Service starting...' -ForegroundColor Cyan
  uvicorn app.main:app --reload --port 8001 --host 0.0.0.0
"@

Start-Sleep 2

# ── 4. Healthcare Core (port 8000) ────────────────────────────────────────────
Write-Host "[Core]     Starting on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  `$Host.UI.RawUI.WindowTitle = 'Hospyn Healthcare Core :8000'
  Set-Location '$ROOT\backend\healthcare-core'
  `$env:PYTHONPATH = '$ROOT\backend'
  Write-Host 'Healthcare Core starting...' -ForegroundColor Cyan
  uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
"@

Start-Sleep 2

# ── 5. Frontend (port 5180) ────────────────────────────────────────────────────
Write-Host "[Frontend] Starting on http://localhost:5180 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  `$Host.UI.RawUI.WindowTitle = 'Hospyn Frontend :5180'
  Set-Location '$ROOT\hospyn-v2-web'
  Write-Host 'Frontend starting...' -ForegroundColor Cyan
  npm run dev
"@

Start-Sleep 4

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan
Write-Host "  All services launched! Open your browser:" -ForegroundColor White
Write-Host ""
Write-Host "  Marketing Landing  → http://localhost:5180/" -ForegroundColor Cyan
Write-Host "  Owner Dashboard    → http://localhost:5180/dashboard" -ForegroundColor Cyan
Write-Host "  Internal Panel     → http://localhost:5180/hospyn-internal" -ForegroundColor Cyan
Write-Host "  Auth API docs      → http://localhost:8001/docs" -ForegroundColor Gray
Write-Host "  Healthcare docs    → http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkCyan
Write-Host ""

# Open browser
Start-Sleep 2
Start-Process "http://localhost:5180/"
