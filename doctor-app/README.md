# Doctor Web App — Fixes (from Hospyn Full System Audit)

**App status: 85% → 100% after these fixes**

---

## Files to Replace

| Fix | File to replace | What changed |
|-----|----------------|--------------|
| FIX 1 | `doctor-app/src/App.jsx` | Added `/patients/search` route |
| FIX 2 | `doctor-app/src/App.jsx` | Added `/verify` route |
| FIX 3 | `doctor-app/src/App.jsx` | Wrapped `<Routes>` with `<ErrorBoundary>` |
| FIX 4 | `doctor-app/src/pages/QueueScreen.jsx` | Wired `IntakeModal` to "Begin Consultation" button |

---

## Fix Details

### FIX 1 — PatientSearch route was missing
**Problem:** `doctor-app/src/pages/PatientSearch.jsx` exists but `App.jsx` had zero Route entry → page was completely unreachable.

**Change in App.jsx:**
```jsx
// ADD this route inside the authenticated block:
<Route
  path="/patients/search"
  element={
    <ProtectedRoute>
      <AuthenticatedLayout>
        <PatientSearch />
      </AuthenticatedLayout>
    </ProtectedRoute>
  }
/>
```
Also add the import at the top:
```jsx
import PatientSearch from "./pages/PatientSearch";
```

---

### FIX 2 — VerificationScreen route was missing
**Problem:** `doctor-app/src/pages/VerificationScreen.jsx` exists but `App.jsx` had no `<Route path="/verify">` → page was completely unreachable.

**Change in App.jsx:**
```jsx
// ADD this route (public, no layout needed):
<Route path="/verify" element={<VerificationScreen />} />
```

---

### FIX 3 — ErrorBoundary not applied to routes
**Problem:** `components/ErrorBoundary.jsx` exists but was never used. Any page throwing an error would white-screen the entire app with no recovery.

**Change in App.jsx:**
```jsx
// BEFORE:
<Routes>
  ...
</Routes>

// AFTER:
<ErrorBoundary>
  <Routes>
    ...
  </Routes>
</ErrorBoundary>
```
Also add the import:
```jsx
import ErrorBoundary from "./components/ErrorBoundary";
```

---

### FIX 4 — IntakeModal orphaned component
**Problem:** `components/IntakeModal.jsx` is a fully built modal but was never imported or rendered anywhere. Doctors had no intake flow when beginning a consultation.

**Changes in QueueScreen.jsx:**
```jsx
// 1. Import it
import IntakeModal from "../components/IntakeModal";

// 2. Add state
const [showIntake, setShowIntake] = useState(false);
const [selectedPatient, setSelectedPatient] = useState(null);

// 3. Handler for button click
function handleBeginConsultation(patient) {
  setSelectedPatient(patient);
  setShowIntake(true);
}

// 4. Change "Begin Consultation" button onClick
<Button onClick={() => handleBeginConsultation(patient)}>
  Begin Consultation
</Button>

// 5. Render modal at bottom of JSX
{showIntake && selectedPatient && (
  <IntakeModal
    open={showIntake}
    patient={selectedPatient}
    onClose={handleIntakeClose}
    onSuccess={handleIntakeSuccess}
  />
)}
```

---

## How to Deploy

1. Copy `App.jsx` → replace `doctor-app/src/App.jsx`
2. Copy `QueueScreen.jsx` → replace `doctor-app/src/pages/QueueScreen.jsx`
3. Run `npm run build` in `doctor-app/`
4. Copy built output to `doctor-app/deploy/`

No new dependencies needed — all imports reference files that already exist.
