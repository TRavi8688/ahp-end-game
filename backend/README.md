# Backend patch required for doctor-app

Two files in healthcare-core need changes for the doctor app to work
correctly. Both are included here in full — replace your copies with
these, or apply the changes described below manually.

## File 1: app/api/router.py

`app/api/v1/workflow.py` already defines `workflow_router`, `tokens_router`,
and `queue_router` but none were ever imported or registered, so several
routes 404'd. This patch adds:

```python
from app.api.v1.workflow import (
    workflow_router as workflow_def_router,
    tokens_router as workflow_tokens_router,
    queue_router as workflow_queue_router,
)
```
and registers them at `/workflows`, `/tokens`, `/queue`.

**Important note:** these three routers operate on a `PatientToken` table
that is never populated for walk-in patients (nothing in the walk-in flow
creates one). The doctor-app frontend does **not** call these routes for
its queue/consultation flow — it correctly uses the walk-in-based routes
in `doctor_queue.py` instead (see File 2). These are registered because
they're real, complete code that may be useful for a future
reception/staff-token feature, but registering them alone does not make
"Start Queue" / "Call Next" work — that requires the doctor-app's frontend
changes (already applied in `doctor-app-fixed.zip`) plus File 2 below.

## File 2: app/api/v1/doctor_queue.py

This is the file that actually needs to change for the doctor-app's core
flow to work. Changes, in order of appearance in the file:

### a) Added `walkin_id` and `queue_state` to GET /patient/{walkin_id}

The response's `profile.id` field is overloaded — it's the walk-in ID
until a `Patient` record is linked, then it silently becomes the
`Patient.id` instead. The frontend had no unambiguous way to know which ID
to use for queue actions. Added explicit `profile.walkin_id` (always the
walk-in ID, never overwritten) and `profile.queue_state` fields.

### b) Fixed vitals never displaying at all

`walkin.triage_vitals_json` is a SQLAlchemy `JSON` column — already a
Python `dict` when read. The old code called `json.loads()` on it, which
always raised `TypeError`, silently swallowed by a bare `except: pass`.
Separately, even with that fixed, it read keys `blood_pressure` /
`oxygen_saturation`, but `triage_service.py`'s real schema stores
`blood_pressure_systolic`/`_diastolic` and `spo2`. Both fixed — vitals
recorded during triage (or via the new intake endpoint, see (d)) now
actually appear on a patient's chart.

### c) Extracted `_assemble_patient_clinical_data()` helper

Factored the allergies/conditions/medications/records parsing logic out of
`get_patient_details` into a reusable function, so the new by-ID endpoint
(see (e)) doesn't duplicate it.

### d) New endpoint: POST /patient/{walkin_id}/intake

`IntakeModal.jsx` (the "Add Baseline Intake" form — conditions, allergies,
home medications, vitals, symptoms) called this exact path, but it never
existed on the backend. Built for real:
- Conditions/allergies write to `Patient.chronic_conditions` /
  `Patient.known_allergies` (same encrypted comma-joined text format
  already read elsewhere in this file).
- Vitals write to `WalkInRequest.triage_vitals_json`, validated through
  the existing `triage_service.validate_vitals()` — the same function the
  nurse triage flow uses.
- Home medications + symptom notes are stored as a `MedicalRecord`
  (`record_type="intake"`) — the same pattern already used for
  prescriptions, and the medication-extraction logic was extended to read
  this record type too (see (c)).
- Requires a linked `Patient` record to save conditions/allergies/meds —
  raises a clear 400 if the walk-in is fully anonymous (no `patient_id`).
  Vitals can still be recorded either way.

### e) New endpoints: GET /patient-record/{patient_id} and GET /patient-record/lookup

`PatientList.jsx` ("all patients I've ever treated") and `PatientSearch.jsx`
(look up by Hospain ID) have no `walkin_id` to work with for patients not
currently checked in today — every "open chart" action from those two
pages was guaranteed to 422 against the walk-in-only endpoint, regardless
of any frontend fix.

- `GET /patient-record/{patient_id}` — full chart by `Patient.id` directly,
  reusing the helper from (c). Also checks for an active walk-in for that
  patient and surfaces its ID if one exists, so the frontend can route to
  the full consultation view (`PatientDetailView.jsx`) instead of the
  read-only chart view when applicable.
- `GET /patient-record/lookup?hospyn_id=...` — resolves a typed Hospain ID
  (e.g. `HOSPYN-123456-ABC`) to a `Patient.id`, for `PatientSearch.jsx`,
  which only collects the human-facing ID.

**Access rule (explicit product decision, confirmed with the requester):**
a doctor may view the full chart of any patient registered at the
doctor's own hospital (`Patient.hospital_id == doctor.hospital_id`) — same
hospital-scoping already used throughout this codebase (RBAC checks, the
queue, `/doctor/my-patients`). There is no finer-grained "only patients
I've personally treated" restriction, because `Patient` has no
doctor-assignment field, and `PatientSearch.jsx`'s purpose is letting a
doctor look up someone they haven't necessarily met yet (e.g. a referral).
This does **not** allow cross-hospital lookups — a patient ID belonging to
a different hospital returns 404, not 403, to avoid confirming the ID is
valid at all.

**Route ordering note:** `/patient-record/lookup` is registered before
`/patient-record/{patient_id}` in the file. This matters — FastAPI matches
routes in registration order, and if the `{patient_id}` (UUID-typed) route
came first, a request to `/patient-record/lookup` would try to parse
"lookup" as a UUID and fail before ever reaching the lookup route. Keep
this order if you reorganize the file.

## How to apply

Replace your copies of `healthcare-core/app/api/router.py` and
`healthcare-core/app/api/v1/doctor_queue.py` with the versions in this
patch folder.

## Verification performed

Both files were verified by actually importing them in Python with the
real project dependencies installed (not just syntax-checked):

```
PYTHONPATH=<repo>/backend:. python3 -c "import app.api.router as r; print(len(r.api_router.routes))"
```

This succeeded with 201 routes registered (up from 199 before this patch),
confirming every new/changed function, class, and import resolves
correctly — no `NameError`, `ImportError`, or `SyntaxError` anywhere in the
changes. The full route table was also printed and cross-checked against
every endpoint string used anywhere in the doctor-app frontend
(`doctor-app-fixed.zip`) — zero remaining mismatches.

A full `pytest`/integration run against a live database was not possible
in this environment (no database connection available), so please run
your normal test suite and a manual smoke test before deploying:
1. Start a queue session as a doctor, call a waiting patient
   (`PATCH /doctor/queue/{walkin_id}/start`).
2. Complete the consultation with notes + a prescription
   (`PATCH /doctor/queue/{walkin_id}/complete`) — confirm the
   `Appointment.diagnosis`/`clinical_notes` columns and the new
   `Prescription` row are populated.
3. Submit a baseline intake for a different patient
   (`POST /doctor/patient/{walkin_id}/intake`) and confirm conditions,
   allergies, and vitals appear correctly on a subsequent
   `GET /doctor/patient/{walkin_id}`.
4. Look up a patient with no active walk-in via
   `GET /doctor/patient-record/lookup?hospyn_id=...` then
   `GET /doctor/patient-record/{patient_id}` and confirm the chart loads.
