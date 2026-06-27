# Doctor App — Production Readiness Report (Final)

Generated: June 2026, second pass. This supersedes the previous version of
this file. Every endpoint claim below was verified two ways: by reading the
actual FastAPI route decorators, Pydantic schemas, and SQLAlchemy models in
the provided backend, and by actually importing the backend modules in a
real Python interpreter to confirm zero NameError/ImportError/SyntaxError
and to print the live FastAPI route table — not just static code reading.

---

## 1. Methodology used this pass

Earlier work in this project found and fixed transport-level bugs (missing
/healthcare prefixes, wrong field names, missing .env config). This pass
went a level deeper: for every endpoint string anywhere in the frontend,
it was checked against the backend's actual registered route table, not
assumed correct just because the URL "looked right" or because a code
comment claimed it was fixed. This caught several endpoints that were
syntactically reachable but called something that never existed on the
backend at all.

---

## 2. Major finding: two disconnected queue systems

The backend has two entirely separate, non-interoperating systems for
"patients waiting to be seen":

- WalkInRequest / QueueState (doctor_queue.py) — what GET /doctor/queue
  actually returns, what the queue screen actually displays, and what
  reception/nurse/doctor staff use day to day.
- PatientToken / WorkflowStage / DoctorSession (workflow.py) — a fully
  separate token/workflow engine. Nothing in the walk-in flow ever creates
  a PatientToken, so this table is permanently empty for walk-in patients.

An earlier pass in this project registered workflow.py's routers
(/queue/session/start, /queue/token/advance, etc.) believing they were the
missing piece for "Start Queue" / "Call Next Patient." They were real,
registered, and non-404ing — but they operated on the wrong, always-empty
table. Calling them always silently returned "no patients waiting," even
with a full visible queue.

Fixed this pass: clinicalService.js, QueueScreen.jsx, and
HomeDashboard.jsx now call the correct walk-in-based endpoints instead:
- PATCH /doctor/queue/{walkin_id}/start — starts a specific patient's
  consultation (replaces the fictional "start session" + "advance token"
  two-step; there's no separate "session" concept in the walk-in model —
  a doctor can act on any waiting patient immediately).
- PATCH /doctor/queue/{walkin_id}/complete — saves chief complaint,
  clinical notes, and diagnosis (on encrypted Appointment columns built
  for exactly this), optionally creates a prescription, and advances the
  queue — all in one transactional call (ClinicalService.complete_consultation,
  which already existed and was already wired into this route, just never
  called by the frontend).

The workflow.py routers are left registered (harmless, and may be useful
for a future reception/staff-token feature) but the doctor-app no longer
calls them.

---

## 3. Fictional endpoints found and resolved

These were called by the frontend but never existed anywhere on the
backend — confirmed via full-repository search:

- POST /consultations ("Save Notes") → Replaced with the real
  PATCH /doctor/queue/{walkin_id}/complete (see #2). Now asks for
  confirmation first since it also ends the visit.
- POST /doctor/patient/{id}/intake → Built for real — new
  POST /doctor/patient/{walkin_id}/intake endpoint. Conditions/allergies
  write to Patient.chronic_conditions / Patient.known_allergies (the same
  encrypted comma-joined text format already read elsewhere); vitals
  write to WalkInRequest.triage_vitals_json via the existing
  triage_service.validate_vitals(); home medications + symptom notes are
  stored as a MedicalRecord (record_type="intake"), the same pattern
  already used for prescriptions.
- POST /doctor/scan-patient + WS events access_granted/access_revoked →
  No backend support at all. Disabled honestly in ScanModal.jsx and the
  "Medical Vault Locked" gate in PatientDetailView.jsx, rather than
  shipping a flow that hangs forever waiting for an approval that can
  never arrive.
- POST /doctor/treatment/{id}/start|end → Removed. The real walk-in model
  has no separate "treatment session" concept — starting/completing a
  consultation (#2) already covers this.
- POST /doctor/patient/{id}/request-vitals → No backend support. Disabled
  with a clear "not available yet" message.
- POST /clinical/records/{id}/verify → No backend support, and
  MedicalRecord has no "verified" column even if it did. Disabled.
- POST /doctor/patient/{hospynId}/upload-report → Wrong path AND wrong
  role — the real upload-report endpoint (patients.py) is restricted to
  require_role("patient"); a doctor would 403 even at the correct URL.
  Disabled.
- POST /lab-orders → A LabOrder model exists but no route creates one.
  Not called from any page — left as a clearly-commented stub
  (clinicalService.orderLabTest throws a clear "not available yet" error).
- POST /doctor/patient/{id}/check-drug → Not called from any page. Removed.

---

## 4. Patient-ID consistency — root-caused and fixed

The backend has at least three different "patient identifier" concepts:

- walkin_id — a specific visit/queue entry today. Required by
  GET /doctor/patient/{walkin_id}, PATCH .../start, PATCH .../complete.
- Patient.id — the permanent patient record. Required by
  POST /prescriptions/ and the new GET /doctor/patient-record/{patient_id}.
- Hospain ID (HOSPYN-123456-ABC) — the human-facing identifier a doctor
  would actually type into a search box.

Root cause found: GET /doctor/patient/{walkin_id}'s response field
profile.id is overloaded — it's the walk-in ID until a Patient record
gets linked, then silently becomes the Patient.id instead. Several pages
were reading whichever one happened to be convenient without knowing
which they'd gotten back. Fixed by adding an explicit, unambiguous
profile.walkin_id field to all patient-detail responses, and updating
every navigation/lookup call to use the right ID for the right endpoint
(walkinId for queue/consultation actions, profile.id for prescriptions).

New capability built (explicit decision in this session): PatientList.jsx
("all patients I've ever treated") and PatientSearch.jsx (look up by
Hospain ID) had no walkin_id to work with at all for patients not
currently checked in — every "open chart" action from these two pages was
guaranteed to 422 regardless of any other fix. Built:

- GET /doctor/patient-record/{patient_id} — full chart by Patient.id
  directly, no walk-in required.
- GET /doctor/patient-record/lookup?hospyn_id=... — resolves a typed
  Hospain ID to a Patient.id for PatientSearch.jsx (which only collects
  the human-facing ID, not a UUID).
- Access rule (explicit product decision): a doctor may view the full
  chart of any patient registered at the doctor's own hospital
  (Patient.hospital_id == doctor.hospital_id) — the same hospital-scoping
  already used throughout this codebase. There's no finer-grained "only
  patients I've personally treated" restriction, because the data model
  has no doctor-assignment field on Patient, and PatientSearch.jsx's
  whole purpose is letting a doctor look up someone they haven't
  necessarily met yet. This intentionally does NOT allow cross-hospital
  lookups.
- New page PatientRecordView.jsx (/patient-record/:patientId) — a
  read-only chart view for this case. Deliberately does not offer
  notes/intake/consultation-completion, since those genuinely require an
  active walk-in; it does offer "Draft Prescription" since that only
  needs a Patient.id. If the looked-up patient happens to have an active
  walk-in today after all, the backend now detects this and the frontend
  routes to the full PatientDetailView.jsx instead.
- PatientSearch.jsx's "Mock navigating to found patient" (its own code
  comment) replaced with a real lookup.

---

## 5. Other real bugs found and fixed this pass

- Vitals never displayed, anywhere, ever. walkin.triage_vitals_json is a
  SQLAlchemy JSON column (already a Python dict), but the read code
  called json.loads() on it — always raised TypeError, silently swallowed
  by a bare except: pass. Separately, even with that fixed, the code read
  keys blood_pressure / oxygen_saturation, but triage_service.py's real
  schema stores blood_pressure_systolic/_diastolic and spo2. Both fixed.
- POST /prescriptions (no trailing slash) vs. the real route
  POST /prescriptions/ — FastAPI 307-redirects, which most clients follow
  correctly but is an avoidable extra round trip some proxies mishandle.
  Fixed to call the exact path.
- createPrescription field name — sent prescription_items, schema
  requires items. Fixed (carried over from the previous pass, re-verified).
- Fabricated default vitals. IntakeModal.jsx defaulted blood pressure to
  "120/80" and heart rate to "72" if a doctor left the fields blank — a
  plausible-looking fake vital sign in a permanent patient record is a
  real safety risk. Fixed to send nothing rather than a fabricated value.
- Prescription "Draft" button with no linked patient. Prescription.patient_id
  strictly foreign-keys to patients.id — if a walk-in has no linked
  Patient record at all, writing a prescription is impossible at the
  database level. The button is now disabled with an explanation in that
  case.

---

## 6. Carried over from the previous pass (still valid, re-verified)

- .env missing /api/v1 — fixed.
- doctorService.getProfile missing entirely (crashed Topbar.jsx and
  HomeDashboard.jsx on every load) — fixed.
- 8+ pages bypassing the API client with raw fetch() missing the
  /healthcare prefix — migrated to apiClient/ApiService.
- OTP send / password reset wrong field names — fixed.
- apiClient.js error messages only reading FastAPI's detail, missing the
  backend's own error_response() message field — fixed.
- Dual localStorage/sessionStorage auth gate forcing re-login on new tab
  — fixed.
- EarningsDashboard.jsx / LeaveManagement.jsx silently faking data on
  error instead of surfacing real failures — fixed.
- SocketContext.jsx connecting to the wrong URL/handshake shape — fixed
  to match the real /healthcare/ws/reception?token=... contract.
- Dead code removed: useAuthStore.js, orphaned root apiClient.js,
  unrouted VerificationScreen.jsx / DoctorDashboard.jsx.

---

## 7. Still-known limitations (real, disclosed, not fixable from this codebase alone)

1. WebSocket real-time updates may still 1008 for some doctors. The only
   real-time endpoint resolves the connecting user against the staff
   table, but doctor onboarding only populates the separate doctors
   table — they aren't linked. The app degrades gracefully (REST polling
   stays authoritative; UI shows "Reconnecting...") but live push won't
   work until that backend linkage exists.
2. Lab ordering has a LabOrder model but no creation endpoint. Stub left
   in clinicalService.js, not called from any page.
3. Drug-interaction checking and doctor-initiated record upload on a
   patient's behalf have no backend support and aren't called from any
   page today.
4. Test infrastructure — LoginScreen.test.jsx imports vitest and
   @testing-library/react, neither declared in package.json. npm test
   cannot run. Pre-existing, not touched this pass.

---

## 8. Verification performed

- npm run build (Vite production build): clean, zero errors, across every
  file touched in both passes.
- Backend: actually importing app.api.v1.doctor_queue and app.api.router
  in Python with all real dependencies installed — confirming every
  new/changed function, class, and import resolves correctly, not just
  syntactically valid.
- Final FastAPI route table printed and every single endpoint string
  anywhere in the doctor-app frontend was cross-checked against it
  programmatically — confirmed zero remaining mismatches.
