# HOSPYN ULTIMATE CTO TECHNICAL BLUEPRINT
## PART 3: API, AUTHENTICATION, AND AI SYSTEMS

---

# SECTION 8 — API BLUEPRINT

The Hospyn API follows RESTful principles, utilizing JSON payloads, standardized HTTP status codes, and Bearer token authentication. All responses wrap data in a standard format: `{"status": "success", "data": {...}, "message": "..."}` or `{"status": "error", "code": "ERR_CODE", "message": "..."}`.

## 8.1 Auth Service (`/api/v1/auth/`)
*   **POST /register**: Creates a new user. Expects `{email, phone, password, role}`. Returns `{user_id, role}`. Rate limit: 10/min.
*   **POST /login**: Authenticates user. Expects `{email, password}`. Returns `{access_token, refresh_token, token_type, user_id, role}`. Rate limit: 5/min.
*   **POST /refresh**: Issues new access token. Expects `{refresh_token}`. Returns `{access_token}`. Validates token_version against Redis.
*   **POST /forgot-password/request**: Initiates reset. Expects `{identifier}`. Returns success message. Rate limit: 3/min.
*   **POST /forgot-password/verify**: Validates OTP. Expects `{identifier, otp}`. Returns single-use `{reset_token}`.
*   **POST /forgot-password/reset**: Sets new password. Expects `{reset_token, new_password}`. Bumps `token_version` (revokes all active sessions).
*   **POST /change-password** (Auth: Bearer): Updates password for logged-in user. Expects `{current_password, new_password}`.
*   **POST /logout** (Auth: Bearer): Blacklists the current JWT `jti` in Redis. Returns success.
*   **GET /me** [NEW] (Auth: Bearer): Returns user profile summary.
*   **PUT /me** [NEW] (Auth: Bearer): Updates basic user details.
*   **DELETE /account** [NEW] (Auth: Bearer): Triggers DPDP right-to-erasure cascade delete.

## 8.2 Healthcare Core (`/api/v1/healthcare/`)
*All endpoints require Bearer Auth.*

**Hospitals**
*   **POST /hospitals**: Registers a facility (Admin only). Expects `{name, reg_number, contact...}`.
*   **GET /hospitals**: Lists/Search hospitals. Returns `[{hospital}]`.
*   **GET /hospitals/{id}**: Details.
*   **GET /hospitals/{id}/stats**: Daily OPD counts, revenue (Hospital Admin only).

**Doctors**
*   **POST /doctors**: Onboards doctor. Expects `{user_id, specialization, license}`.
*   **GET /doctors**: Search doctors by specialization/location.
*   **GET /doctors/{id}/queue**: Returns live `WalkInRequests` assigned to doctor.
*   **POST /doctors/{id}/status**: Set `on_duty`, `off_duty`, `in_surgery`.

**Patients & Records**
*   **POST /patients**: Onboards patient profile (links to user_id).
*   **GET /patients/{id}**: Fetch profile (includes encrypted PHI).
*   **GET /patients/{id}/records**: List `MedicalRecord`s.
*   **POST /patients/{id}/records**: Request GCS signed URL for upload. Expects `{file_name, type}`. Returns `{upload_url, record_id}`.
*   **POST /patients/{id}/share**: Grant explicit RBAC access to a specific doctor.

**Appointments & Walk-in Queue**
*   **POST /appointments**: Book future slot. Expects `{doctor_id, scheduled_at}`.
*   **POST /walkin**: Create live queue entry. Expects `{hospital_id, phone, reason}`. Returns `{id, token_number}`.
*   **PATCH /walkin/{id}/accept**: Reception acknowledges arrival.
*   **PATCH /walkin/{id}/triage**: Nurse begins vitals check.
*   **POST /walkin/{id}/vitals**: Save vitals JSON. Triggers AI risk assessment.
*   **PATCH /walkin/{id}/route**: Assign to specific doctor.
*   **PATCH /walkin/{id}/consult**: Doctor begins. Creates linked `Appointment` record.
*   **POST /appointments/{id}/notes**: Doctor saves clinical notes (Encrypted).
*   **POST /appointments/{id}/prescription**: Doctor issues e-prescription.
*   **PATCH /walkin/{id}/complete**: Closes the encounter.

## 8.3 Ancillary Services (Upcoming)
*   **/api/v1/pharmacy/**: `/inventory`, `/prescriptions/pending`, `/dispense`.
*   **/api/v1/lab/**: `/tests`, `/samples/{id}/status`, `/results/upload`.
*   **/api/v1/billing/**: `/generate-invoice`, `/payments/webhook`, `/receipts/{id}/pdf`.
*   **/api/v1/ai/**: `/chat`, `/summarize-record`, `/symptom-triage`.

---

# SECTION 9 — AUTHENTICATION SYSTEM

The authentication boundary is the most fortified aspect of Hospyn, strictly separating identity from medical data.

## 9.1 Registration & Login Flows
*   **Email Registration**: User submits email + password. Auth service hashes password via bcrypt (work factor 12). Returns JWT.
*   **Phone Registration (OTP)**: User submits phone. OTP generated, hashed via HMAC-SHA256, and stored. SMS dispatched. User submits OTP. If match, returns JWT.
*   **Device Tracking**: On login, headers (User-Agent, IP) are hashed to create a device fingerprint. Anomalous logins trigger email alerts.

## 9.2 Token Architecture (JWT)
We use a dual-token architecture to balance security and UX.
*   **Access Token (JWT)**: Signed via HS256 (Secret managed via KMS). Contains `sub` (user_id), `role`, `token_version`, `jti`. **Expiry: 15 minutes**.
*   **Refresh Token (JWT)**: **Expiry: 7 days**. Sent via HTTP-Only, Secure cookies (web) or SecureStorage (mobile).
*   **Token Revocation Strategy**: 
    1.  *Soft Blacklist*: On manual logout, the `jti` is pushed to Redis with a TTL equal to the token's remaining life. The API Gateway validates `jti` against Redis.
    2.  *Hard Revocation (Password Change/Breach)*: The user's `token_version` in the DB is incremented. The API Gateway caches this version. If a JWT presents an older `token_version`, it is immediately rejected, instantly revoking all active sessions across all devices.

## 9.3 OTP System Hardening
Legacy systems use slow bcrypt for OTPs, leading to DoS vulnerabilities during SMS bursts. Hospyn uses **HMAC-SHA256** for OTP hashing.
*   **Rate Limits**: 3 requests per minute per identifier.
*   **Brute-Force Guard**: Maximum 5 failed attempts per OTP. On the 6th failure, the OTP is mathematically locked.

---

# SECTION 10 — AUTHORIZATION SYSTEM

Hospyn uses a hybrid RBAC (Role-Based Access Control) and ABAC (Attribute-Based Access Control) model enforced via FastAPI dependency injection.

## 10.1 Role Hierarchy
1.  `super_admin`: Platform god-mode (System configuration, global audits).
2.  `hospital_admin`: Full access, strictly bound to `hospital_id`.
3.  `doctor`: Write access to clinical notes, read access to assigned patient histories.
4.  `nurse`: Write access to triage vitals, read access to hospital queues.
5.  `receptionist`: Write access to walk-in queue and billing. NO read access to clinical notes.
6.  `patient`: Read/Write access *only* to records where `patient.user_id == token.sub`.

## 10.2 ABAC Implementation (The "Scope" Check)
A receptionist cannot query data for Hospital B if they work at Hospital A.
*   *Implementation*: The `RequireRole(["receptionist"])` FastAPI dependency checks the token. Then, the `get_current_staff_member` dependency fetches the staff profile, injecting the `hospital_id` into the Request context. SQLAlchemy queries are dynamically modified: `query.where(WalkInRequest.hospital_id == context.hospital_id)`.

## 10.3 Patient Consent Protocol
Doctors cannot arbitrarily search and view any patient's PHI. Access is granted if and only if:
1.  The patient has an active, uncompleted Appointment/WalkIn assigned to that doctor.
2.  OR, the patient has explicitly generated a "Share Link" or "Consent Token" granting that doctor access for a specific time window.

## 10.4 Break-Glass Emergency Protocol
In a P0 medical emergency, an ER doctor can bypass the consent protocol.
*   *Action*: Doctor clicks "Emergency Override".
*   *Result*: Access granted. High-priority SMS sent to Hospital Admin and Patient. Immutable entry written to `audit_logs` with HMAC signature. Access auto-revokes after 24 hours.

---

# SECTION 11 — AI ARCHITECTURE

Hospyn is an AI-Native platform. LLMs are not a gimmick; they are embedded into the critical path of clinical workflows to reduce friction.

## 11.1 Models & Infrastructure
*   **Primary Provider**: Google Vertex AI.
*   **Text/Reasoning**: `gemini-1.5-pro` (High accuracy clinical tasks) & `gemini-1.5-flash` (Fast, low-latency chatbot tasks).
*   **Vision/OCR**: `gemini-1.5-pro-vision` for reading handwritten prescriptions and legacy lab reports.
*   **Embeddings**: `text-embedding-004` for vectorizing medical text.

## 11.2 Core AI Modules
1.  **AI Receptionist (Telephony/WhatsApp)**
    *   *Purpose*: Automate inbound calls. "I want to book Dr. Sharma for tomorrow."
    *   *Workflow*: Speech-to-Text → Intent Classification (LLM) → Slot Extraction → API call to `/appointments` → Text-to-Speech response.
2.  **Chitti AI (Patient Health Assistant)**
    *   *Purpose*: Answer patient queries based *only* on their uploaded records.
    *   *Workflow*: Patient asks question → Vector DB searches patient's records → Top K chunks retrieved → RAG prompt sent to Gemini → Response streamed to mobile app.
    *   *Safety Guardrail*: System prompt strictly enforces: "You are an assistant, not a doctor. Never diagnose. Always append: 'Please consult your doctor for medical advice.'"
3.  **Nurse Triage Auto-Escalation**
    *   *Purpose*: Detect emergencies during vitals entry.
    *   *Workflow*: Nurse enters vitals (e.g., BP 180/110). A deterministic rules engine + lightweight ML classifier flags the walk-in request as `PriorityLevel.emergency`, instantly alerting the assigned doctor.
4.  **Clinical Note Summarizer**
    *   *Purpose*: Save doctors time.
    *   *Workflow*: Patient uploads 50 pages of past PDF records. Gemini Vision OCRs the docs, extracts the text, and generates a structured 1-page JSON summary: `[Chronic Conditions], [Past Surgeries], [Current Meds]`. The doctor reads the summary in 30 seconds instead of reading 50 pages.
