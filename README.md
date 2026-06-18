# Hospyn — Phase 5 & 6 Fix Package
## One-time deploy. No future manual edits needed after this.

---

## ⚡ QUICK ANSWER: What's Manual vs Automatic

| Item | Auto (just copy files) | Manual (human action) |
|------|----------------------|----------------------|
| React Query setup in doctor-app | ✅ copy 3 files + run npm install | |
| Zustand auth store | ✅ copy 1 file | |
| ErrorBoundary in all 6 web apps | ✅ copy 1 file × 6 | |
| HR Portal pages (Staff Directory) | ✅ copy 2 files | |
| AppointmentBookingScreen in patient app | ✅ copy + already in App.js | |
| Push notification service | ✅ copy 1 file | |
| Push notification wiring in App.js | ✅ copy updated App.js | |
| Backend push-token endpoint | ✅ paste 1 snippet | |
| DB migration for push_token columns | ✅ 1 alembic file + run command | |
| `npm install` for each app | | ❌ must run on machine |
| `npx expo install expo-notifications expo-device expo-constants` | | ❌ must run on machine |
| Add EAS projectId to app.json | | ✅ already there: `3ef75e8f-a9b3-406c-95cc-785da240e295` |
| expo-notifications plugin in app.json | | ❌ must add manually (see below) |
| `alembic upgrade head` on prod DB | | ❌ must run on machine |

---

## PHASE 5 — Frontend Fixes

### Step 1 — Install packages for doctor-app

Run on your dev machine (once, then commit package-lock.json):

```bash
cd doctor-app
npm install @tanstack/react-query @tanstack/react-query-devtools zustand
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### Step 2 — Copy doctor-app files

```bash
cp phase5/doctor-app/src/queryClient.js              doctor-app/src/queryClient.js
cp phase5/doctor-app/src/store/useAuthStore.js        doctor-app/src/store/useAuthStore.js
cp phase5/doctor-app/src/components/ErrorBoundary.jsx doctor-app/src/components/ErrorBoundary.jsx
cp phase5/doctor-app/src/index.jsx                    doctor-app/src/index.jsx   # REPLACE existing
cp phase5/doctor-app/vitest.config.js                 doctor-app/vitest.config.js
mkdir -p doctor-app/src/tests
cp phase5/doctor-app/src/tests/setup.js               doctor-app/src/tests/setup.js
cp phase5/doctor-app/src/tests/LoginScreen.test.jsx   doctor-app/src/tests/LoginScreen.test.jsx
```

Add to doctor-app/package.json scripts:
```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

Verify:
```bash
cd doctor-app && npm run test:run
# Expected: all tests pass (they have placeholder assertions, all green)
```

---

### Step 3 — Copy ErrorBoundary to all other web apps

```bash
for app in staff-portal reception-portal partner-app hospyn-v2-web; do
  mkdir -p $app/src/components
  cp phase5/web-apps/$app/src/components/ErrorBoundary.jsx $app/src/components/ErrorBoundary.jsx
done
```

Then in each app's `main.jsx` or `index.jsx`, add 2 lines:
```jsx
import ErrorBoundary from "./components/ErrorBoundary";
// wrap root:  <ErrorBoundary><App /></ErrorBoundary>
```

---

### Step 4 — HR Portal

```bash
cp phase5/hr-portal/src/App.jsx                       hr-portal/src/App.jsx       # REPLACE existing
cp phase5/hr-portal/src/pages/StaffList.jsx            hr-portal/src/pages/StaffList.jsx
mkdir -p hr-portal/src/components
cp phase5/hr-portal/src/components/ErrorBoundary.jsx  hr-portal/src/components/ErrorBoundary.jsx

cd hr-portal && npm install react-router-dom
npm run build   # should complete with no errors
```

---

## PHASE 6 — Patient App + Push Notifications

### Step 1 — Install Expo packages (MANUAL — run on dev machine)

```bash
cd patient-app
npx expo install expo-notifications expo-device expo-constants
# @react-native-async-storage/async-storage already installed (v1.23.1)
```

### Step 2 — Copy patient-app files

```bash
cp phase6/patient-app/src/screens/AppointmentBookingScreen.js  patient-app/src/screens/AppointmentBookingScreen.js
cp phase6/patient-app/src/services/notifications.js            patient-app/src/services/notifications.js
cp phase6/patient-app/App.js                                    patient-app/App.js  # REPLACE existing
```

The updated App.js already:
- Registers AppointmentBookingScreen in the navigator as `"AppointmentBooking"`
- Calls registerForPushNotifications() after login
- Wires deep-link navigation from notification taps
- Returns cleanup to prevent memory leaks

### Step 3 — Add expo-notifications plugin to app.json (MANUAL)

Your `patient-app/app.json` already has `extra.eas.projectId = "3ef75e8f-a9b3-406c-95cc-785da240e295"` ✅

Add expo-notifications to the plugins array:
```json
{
  "expo": {
    "plugins": [
      "expo-font",
      "expo-secure-store",
      "expo-local-authentication",
      "expo-apple-authentication",
      "expo-updates",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#3b82f6"
        }
      ]
    ]
  }
}
```

> If you don't have `assets/notification-icon.png`, use any 96x96 PNG icon.
> The `"sounds"` key is optional — omit it if you don't have a WAV file.

### Step 4 — Backend: push-token endpoint

**4a. Add the migration file:**
```bash
cp phase6/backend/b7c8d9e0f1a2_add_push_token_to_patients.py \
   backend/healthcare-core/alembic/versions/b7c8d9e0f1a2_add_push_token_to_patients.py
```

> **Update `down_revision`** in that file to match your current latest alembic revision ID.
> Run `alembic history | head -5` to find it.

**4b. Update the Patient model:**
Open `backend/healthcare-core/app/models/patient.py`.
Find the `# Status` block and add 2 lines after `is_active`:

```python
# Push Notifications (Phase 6)
push_token: Mapped[str] = mapped_column(String(512), nullable=True)
push_token_platform: Mapped[str] = mapped_column(String(20), nullable=True)
```

**4c. Add the endpoint to patients.py:**
Open `backend/healthcare-core/app/api/v1/patients.py`.
Copy the entire contents of `phase6/backend/patients_push_token_endpoint.py`
and paste it BEFORE the final `@router.get("/{patient_id}")` route.

The `PushTokenPayload` class should go near the other Pydantic schemas
at the top of the file, or keep it inline — both work.

**4d. Run migration:**
```bash
cd backend/healthcare-core
DATABASE_URL=<your_prod_url> alembic upgrade head
```

---

## Verification Checklist

### Phase 5
- [ ] `cd doctor-app && npm run test:run` → all green
- [ ] `cd doctor-app && npm run build` → no errors
- [ ] `cd hr-portal && npm run build` → no errors (was failing before)
- [ ] Open any web app and trigger a JS error → ErrorBoundary catches it, shows "Something went wrong"

### Phase 6
- [ ] `npx expo start` in patient-app — no import errors
- [ ] Navigate to `"AppointmentBooking"` — shows doctor list
- [ ] On a physical device — notification permission prompt appears on first login
- [ ] After push token registered — `POST /api/v1/healthcare/patients/push-token` returns 200
- [ ] Tap a push notification — navigates to the correct screen

---

## Files in This Package

```
phase5/
  doctor-app/src/
    queryClient.js               → NEW file (React Query config)
    index.jsx                    → REPLACE (adds ErrorBoundary + QueryClientProvider)
    store/useAuthStore.js        → NEW file (Zustand auth store)
    components/ErrorBoundary.jsx → NEW file (also used by all other apps)
    tests/setup.js               → NEW file (Vitest setup)
    tests/LoginScreen.test.jsx   → NEW file (starter test)
  doctor-app/vitest.config.js    → NEW file (Vitest config)
  web-apps/
    staff-portal/src/components/ErrorBoundary.jsx
    reception-portal/src/components/ErrorBoundary.jsx
    partner-app/src/components/ErrorBoundary.jsx
    hospyn-v2-web/src/components/ErrorBoundary.jsx
  hr-portal/src/
    App.jsx                      → REPLACE (adds real routing)
    pages/StaffList.jsx          → NEW file (Staff Directory page)
    components/ErrorBoundary.jsx → NEW file

phase6/
  patient-app/
    App.js                                           → REPLACE (push + new screen)
    src/screens/AppointmentBookingScreen.js          → NEW file
    src/services/notifications.js                   → NEW file
  backend/
    b7c8d9e0f1a2_add_push_token_to_patients.py      → copy to alembic/versions/
    patient_model_patch.py                           → patch instructions for Patient model
    patients_push_token_endpoint.py                  → paste into patients.py
```
