$ErrorActionPreference = "Stop"

$repo = "c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new"
$downloads = "C:\Users\DELL\Downloads"

Write-Host "1. Backing up patched files..."
$backupDir = "$repo\backup_patched"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$patchedFiles = @(
    "backend\auth-service\app\api\v1\auth.py",
    "backend\auth-service\app\main.py",
    "backend\auth-service\app\core\security.py",
    "backend\healthcare-core\app\main.py",
    "backend\healthcare-core\app\core\security.py",
    "backend\ai-service\app\main.py",
    "backend\auth-service\requirements.txt",
    "backend\healthcare-core\requirements.txt",
    "backend\ai-service\requirements.txt",
    ".github\workflows\deploy.yml"
)

foreach ($f in $patchedFiles) {
    if (Test-Path "$repo\$f") {
        $dest = "$backupDir\$($f -replace '\\', '_')"
        Copy-Item "$repo\$f" -Destination $dest -Force
    }
}

Write-Host "2. Syncing Frontend (Phase 5)..."
Copy-Item "$downloads\phase-5\hospyn-phase5\hr-portal\*" -Destination "$repo\hr-portal" -Recurse -Force
Copy-Item "$downloads\phase-5\hospyn-phase5\super-admin-dashboard\*" -Destination "$repo\super-admin-dashboard" -Recurse -Force
Copy-Item "$downloads\phase-5\hospyn-phase5\shared\*" -Destination "$repo\shared" -Recurse -Force

Write-Host "3. Syncing Backend (Phase 6)..."
Copy-Item "$downloads\phase-6\hospyn-phase6\backend\healthcare-core\*" -Destination "$repo\backend\healthcare-core" -Recurse -Force
if (Test-Path "$downloads\phase-6\hospyn-phase6\frontend\src\components\ConsentCollection.jsx") {
    $targetDir = "$repo\frontend\src\components"
    if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Force -Path $targetDir | Out-Null }
    Copy-Item "$downloads\phase-6\hospyn-phase6\frontend\src\components\ConsentCollection.jsx" -Destination "$targetDir\ConsentCollection.jsx" -Force
}

Write-Host "4. Syncing Backend (Phase 8)..."
Copy-Item "$downloads\phase-8\hospyn-phase8\backend\healthcare-core\*" -Destination "$repo\backend\healthcare-core" -Recurse -Force
Copy-Item "$downloads\phase-8\hospyn-phase8\backend\auth-service\*" -Destination "$repo\backend\auth-service" -Recurse -Force

Write-Host "5. Syncing Test Suites (Phase 7)..."
Copy-Item "$downloads\phase-7\*.py" -Destination "$repo\" -Force
if (Test-Path "$downloads\phase-7\pytest.root.ini") {
    Copy-Item "$downloads\phase-7\pytest.root.ini" -Destination "$repo\pytest.ini" -Force
}

Write-Host "6. Syncing Migrations (Phase 1)..."
Copy-Item "$downloads\phase-1\20260605_add_performance_indexes.py" -Destination "$repo\alembic\versions\20260605_add_performance_indexes.py" -Force
Copy-Item "$downloads\phase-1\20260605_dpdp_compliance_tables.py" -Destination "$repo\alembic\versions\20260605_dpdp_compliance_tables.py" -Force
Copy-Item "$downloads\phase-1\20260605_phase3_patient_device_tokens.py" -Destination "$repo\alembic\versions\20260605_phase3_patient_device_tokens.py" -Force
Copy-Item "$downloads\phase-1\MIGRATION_STRATEGY.md" -Destination "$repo\MIGRATION_STRATEGY.md" -Force
Copy-Item "$downloads\phase-1\verify_migrations.sh" -Destination "$repo\verify_migrations.sh" -Force

Write-Host "7. Restoring Patched Files..."
foreach ($f in $patchedFiles) {
    $src = "$backupDir\$($f -replace '\\', '_')"
    if (Test-Path $src) {
        Copy-Item $src -Destination "$repo\$f" -Force
    }
}

Write-Host "Sync completed successfully."
