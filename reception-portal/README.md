# Reception Module — Drop-in Files

## Exact file placement for `staff-portal/`

```
staff-portal/src/
├── services/
│   └── receptionApi.js              ← All API calls (patients, queue, doctors, WS)
│
├── hooks/
│   ├── useAuth.js                   ← Auth context + hook (fixes login bridge)
│   ├── useLiveQueue.js              ← WebSocket + polling fallback
│   └── usePatientSearch.js          ← Debounced patient search
│
├── utils/
│   └── printToken.js                ← Browser print for token slips
│
├── styles/
│   └── reception.css                ← Spinner, focus rings, print media
│
├── components/reception/
│   ├── PatientSearchBar.jsx         ← Search + dropdown (GET /patients/search)
│   ├── WalkInRegistrationForm.jsx   ← New patient modal (POST /patients)
│   ├── TokenAssignmentModal.jsx     ← Doctor select + POST /queue/token
│   ├── EmergencyTokenButton.jsx     ← One-click emergency override
│   ├── LiveQueueBoard.jsx           ← Real-time board (WebSocket)
│   └── DoctorAvailabilityView.jsx   ← Doctor status grid
│
├── pages/
│   ├── LoginPage.jsx                ← Fixed auth bridge to backend
│   ├── ReceptionLayout.jsx          ← Sidebar nav + Outlet
│   ├── CheckInPage.jsx              ← CORE: Search → Register → Token flow
│   ├── QueueBoardPage.jsx           ← Full queue management page
│   └── TodaysAppointmentsPage.jsx   ← Appointments with check-in action
│
└── routes/
    ├── ProtectedRoute.jsx           ← Role-based guard
    └── receptionRoutes.jsx          ← Drop into App.jsx Routes
```

## Integration — 3 steps

### Step 1 — Add to App.jsx
```jsx
import { receptionRoutes } from "./routes/receptionRoutes";
import { AuthProvider } from "./hooks/useAuth";

// Wrap your <BrowserRouter> content:
<AuthProvider>
  <Routes>
    {receptionRoutes}
    {/* ... other routes ... */}
  </Routes>
</AuthProvider>
```

### Step 2 — Set env variable
```bash
# staff-portal/.env
VITE_API_URL=http://your-backend-host:8000
```

### Step 3 — Import CSS
```jsx
// In main.jsx or ReceptionLayout.jsx
import "./styles/reception.css";
```

## What this fixes (from audit)

| Audit Item | Status | File |
|---|---|---|
| Login — no backend auth bridge | ✅ FIXED | `LoginPage.jsx` + `useAuth.js` |
| Live Queue Board — static, no WebSocket | ✅ FIXED | `LiveQueueBoard.jsx` + `useLiveQueue.js` |
| Check-In Patient — MISSING | ✅ BUILT | `CheckInPage.jsx` |
| Walk-In Registration — MISSING | ✅ BUILT | `WalkInRegistrationForm.jsx` |
| Token Assignment — MISSING | ✅ BUILT | `TokenAssignmentModal.jsx` |
| Today's Appointments — static | ✅ FIXED | `TodaysAppointmentsPage.jsx` |
| Doctor Availability — MISSING | ✅ BUILT | `DoctorAvailabilityView.jsx` |
| Emergency Token — MISSING | ✅ BUILT | `EmergencyTokenButton.jsx` |
| Token Print — MISSING | ✅ BUILT | `printToken.js` |
| All API endpoints wired | ✅ DONE | `receptionApi.js` |

## Backend endpoints required
All exist per your audit. Ensure these are live:
- `POST /auth/login`
- `GET /patients/search?q=`
- `POST /patients`
- `GET /doctors?hospital_id=&available_now=true`
- `GET /departments?hospital_id=`
- `POST /queue/token`
- `GET /queue/live?hospital_id=`
- `GET /appointments?hospital_id=&date=`
- `POST /appointments/:id/checkin`
- `WS /ws/queue/:hospital_id`
