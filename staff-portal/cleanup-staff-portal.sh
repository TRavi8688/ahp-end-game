#!/bin/bash
# cleanup-staff-portal.sh
# Run this from the ROOT of your staff-portal-v2 directory.
# It removes all orphan and duplicate legacy files identified in the audit.
#
# Usage:
#   cd path/to/staff-portal-v2
#   bash cleanup-staff-portal.sh
#
# Preview mode (dry-run, shows what would be deleted without deleting):
#   bash cleanup-staff-portal.sh --dry-run

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE — nothing will be deleted ==="
fi

delete() {
  local FILE="$1"
  if [[ -f "$FILE" ]]; then
    if $DRY_RUN; then
      echo "[DRY RUN] Would delete: $FILE"
    else
      rm "$FILE"
      echo "Deleted: $FILE"
    fi
  else
    echo "Skipped (not found): $FILE"
  fi
}

echo ""
echo "=== Removing DUPLICATE legacy files ==="
# These are old root-level copies — correct versions are in src/pages/Dashboard/
delete "src/pages/LoginPage.jsx"
delete "src/pages/SetupWizard.jsx"
delete "src/pages/AdminDashboard.jsx"

echo ""
echo "=== Removing ORPHAN pages (not in App.tsx, have duplicate logic in Dashboard/) ==="
delete "src/pages/DoctorQueue.jsx"
delete "src/pages/LabManager.jsx"
delete "src/pages/NurseVitals.jsx"
delete "src/pages/PharmacyStockEntry.jsx"
delete "src/pages/ReceptionRegister.jsx"

echo ""
echo "=== Done ==="
if $DRY_RUN; then
  echo "Run without --dry-run to actually delete files."
fi
