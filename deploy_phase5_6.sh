#!/usr/bin/env bash
# deploy_phase5_6.sh
#
# Run this from the ROOT of your hospyn repo:
#   chmod +x deploy_phase5_6.sh
#   ./deploy_phase5_6.sh
#
# This script copies all Phase 5 & 6 files into the correct locations.
# It does NOT run npm install or alembic — those still need a human.
# After this script, follow the INSTALL steps in README.md.

set -e
FIXES_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🏥 Hospyn Phase 5 & 6 Deploy Script"
echo "======================================"
echo ""

# ── Phase 5: doctor-app ──────────────────────────────────────────────────────
echo "📦 Phase 5: doctor-app..."

mkdir -p doctor-app/src/store
mkdir -p doctor-app/src/components
mkdir -p doctor-app/src/tests

cp "$FIXES_DIR/phase5/doctor-app/src/queryClient.js"              doctor-app/src/queryClient.js
cp "$FIXES_DIR/phase5/doctor-app/src/store/useAuthStore.js"        doctor-app/src/store/useAuthStore.js
cp "$FIXES_DIR/phase5/doctor-app/src/components/ErrorBoundary.jsx" doctor-app/src/components/ErrorBoundary.jsx
cp "$FIXES_DIR/phase5/doctor-app/src/index.jsx"                    doctor-app/src/index.jsx
cp "$FIXES_DIR/phase5/doctor-app/vitest.config.js"                 doctor-app/vitest.config.js
cp "$FIXES_DIR/phase5/doctor-app/src/tests/setup.js"               doctor-app/src/tests/setup.js
cp "$FIXES_DIR/phase5/doctor-app/src/tests/LoginScreen.test.jsx"   doctor-app/src/tests/LoginScreen.test.jsx

echo "  ✅ doctor-app files copied"

# ── Phase 5: web apps ────────────────────────────────────────────────────────
echo "📦 Phase 5: web apps (ErrorBoundary)..."

for app in staff-portal reception-portal partner-app hospyn-v2-web; do
  if [ -d "$app" ]; then
    mkdir -p "$app/src/components"
    cp "$FIXES_DIR/phase5/web-apps/$app/src/components/ErrorBoundary.jsx" \
       "$app/src/components/ErrorBoundary.jsx"
    echo "  ✅ $app/src/components/ErrorBoundary.jsx"
  else
    echo "  ⚠️  $app directory not found — skipping"
  fi
done

# ── Phase 5: HR portal ───────────────────────────────────────────────────────
echo "📦 Phase 5: hr-portal..."

if [ -d "hr-portal" ]; then
  mkdir -p hr-portal/src/pages
  mkdir -p hr-portal/src/components
  cp "$FIXES_DIR/phase5/hr-portal/src/App.jsx"               hr-portal/src/App.jsx
  cp "$FIXES_DIR/phase5/hr-portal/src/pages/StaffList.jsx"   hr-portal/src/pages/StaffList.jsx
  cp "$FIXES_DIR/phase5/hr-portal/src/components/ErrorBoundary.jsx" \
     hr-portal/src/components/ErrorBoundary.jsx
  echo "  ✅ hr-portal files copied"
else
  echo "  ⚠️  hr-portal directory not found"
fi

# ── Phase 6: patient-app ─────────────────────────────────────────────────────
echo "📦 Phase 6: patient-app..."

if [ -d "patient-app" ]; then
  mkdir -p patient-app/src/screens
  mkdir -p patient-app/src/services
  cp "$FIXES_DIR/phase6/patient-app/App.js"                                         patient-app/App.js
  cp "$FIXES_DIR/phase6/patient-app/src/screens/AppointmentBookingScreen.js"         patient-app/src/screens/AppointmentBookingScreen.js
  cp "$FIXES_DIR/phase6/patient-app/src/services/notifications.js"                  patient-app/src/services/notifications.js
  echo "  ✅ patient-app files copied"
else
  echo "  ⚠️  patient-app directory not found"
fi

# ── Phase 6: backend migration ───────────────────────────────────────────────
echo "📦 Phase 6: backend alembic migration..."

ALEMBIC_DIR="backend/healthcare-core/alembic/versions"
if [ -d "$ALEMBIC_DIR" ]; then
  cp "$FIXES_DIR/phase6/backend/b7c8d9e0f1a2_add_push_token_to_patients.py" \
     "$ALEMBIC_DIR/b7c8d9e0f1a2_add_push_token_to_patients.py"
  echo "  ✅ Migration file copied to $ALEMBIC_DIR"
  echo "  ⚠️  MANUAL: update down_revision in the migration file to your current latest revision"
  echo "  ⚠️  MANUAL: patch backend/healthcare-core/app/models/patient.py (see patient_model_patch.py)"
  echo "  ⚠️  MANUAL: paste endpoint from patients_push_token_endpoint.py into patients.py"
else
  echo "  ⚠️  Alembic versions dir not found at $ALEMBIC_DIR"
fi

echo ""
echo "======================================"
echo "✅  File copy complete!"
echo ""
echo "⚡ REMAINING MANUAL STEPS:"
echo ""
echo "  1. cd doctor-app && npm install @tanstack/react-query @tanstack/react-query-devtools zustand"
echo "     npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom"
echo "     npm run test:run   # verify all green"
echo ""
echo "  2. In each web app's main.jsx, wrap <App /> with <ErrorBoundary>"
echo "     (staff-portal, reception-portal, partner-app, hospyn-v2-web)"
echo ""
echo "  3. cd hr-portal && npm install react-router-dom && npm run build"
echo ""
echo "  4. cd patient-app && npx expo install expo-notifications expo-device expo-constants"
echo ""
echo "  5. Add expo-notifications plugin to patient-app/app.json (see README.md)"
echo ""
echo "  6. Patch Patient model + paste push-token endpoint (see README.md Phase 6 Step 4)"
echo ""
echo "  7. cd backend/healthcare-core && alembic upgrade head"
echo ""
echo "See README.md for full details and verification checklist."
