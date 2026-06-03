# HOSPYN ULTIMATE CTO TECHNICAL BLUEPRINT
## PART 2: FRONTEND, BACKEND, AND DATABASE ARCHITECTURE

---

# SECTION 5 — FRONTEND BLUEPRINT

## Technology Stack Justification
Hospyn standardizes on a unified JavaScript/TypeScript ecosystem for all frontends to allow engineering mobility across teams.

*   **Patient App & Pharmacy App (Mobile)**: `React Native + Expo`
    *   *Why*: Allows rapid cross-platform deployment (iOS & Android) from a single codebase. Expo Application Services (EAS) handles OTA updates, circumventing App Store review delays for critical hotfixes.
*   **All Web Dashboards (Doctor, Reception, Admin, Staff, Partner, HR, Lab)**: `React + Vite + TypeScript`
    *   *Why*: Vite provides lightning-fast HMR and optimized production builds. TypeScript is mandatory to enforce strict payload contracts with the backend. We use standard React Single Page Application (SPA) architecture because these are authenticated enterprise apps where SEO is irrelevant, but fast client-side state transitions are paramount.
*   **Hospyn V2 Web (Public)**: `React + Vite + Tailwind CSS` (Future: Next.js)
    *   *Why*: Required for public-facing SEO, marketing, and web patient portal.
*   **Styling**: `Tailwind CSS` + `shadcn/ui` (Web), `NativeWind` (Mobile)
    *   *Why*: Utility-first CSS guarantees zero dead code and consistent design tokens.
*   **State Management**: `Zustand` (Client State) + `React Query` (Server State)
    *   *Why*: Redux is too verbose for modern React. React Query handles caching, background fetching, and optimistic updates out-of-the-box. Zustand provides a lightweight, hook-based global store for UI state (e.g., active theme, sidebar toggles).

## Complete Production Folder Structure (Web Standard)
*Example: `doctor-app/` or `staff-portal/`*

```text
src/
├── api/                  # Axios instances and interceptors (auth token injection)
├── assets/               # SVGs, Lottie animations, fonts
├── components/           # Reusable UI organized by Atomic Design
│   ├── ui/               # Atoms (Buttons, Inputs, Badges - shadcn)
│   ├── forms/            # Molecules (Form groups, Selects with validation)
│   ├── shared/           # Organisms (Navbar, Sidebar, PatientCard)
│   └── layouts/          # Templates (DashboardLayout, AuthLayout)
├── constants/            # ENV vars, Enums, Routes, Theme configs
├── contexts/             # React Contexts (AuthContext, WebSocketContext)
├── hooks/                # Custom hooks (useAuth, useDebounce, useLiveQueue)
├── i18n/                 # Localization JSONs (en.json, hi.json, te.json)
├── pages/                # Route components (Dashboard.tsx, Login.tsx)
│   ├── auth/             # Grouped by domain
│   ├── consultations/
│   └── settings/
├── routes/               # React Router definitions & Protected Routes
├── services/             # Abstractions over API calls (DoctorService.ts)
├── store/                # Zustand stores (useAppStore.ts)
├── types/                # TypeScript interfaces representing Backend Schemas
├── utils/                # Pure functions (formatDate, parseVitals, crypto helpers)
└── tests/                # Vitest/RTL unit and component tests
```

## Complete Production Folder Structure (Mobile Standard)
*Example: `patient-app/`*

```text
src/
├── api/                  # API client setup
├── assets/               # Images and custom fonts
├── components/           # UI components
│   ├── atoms/
│   ├── molecules/
│   └── organisms/
├── constants/            # Colors, spacing, typography (Theme)
├── hooks/                # Custom React Native hooks
├── navigation/           # React Navigation setups
│   ├── AppNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── TabNavigator.tsx
├── screens/              # Full-screen components
│   ├── Auth/             # LoginScreen, RegisterScreen, OTPVerifyScreen
│   ├── Main/             # HomeScreen, RecordsScreen, AppointmentsScreen
│   └── Modals/           # VitalsModal, PaymentModal
├── services/             # SecureStorage, Push Notifications
├── store/                # Zustand
├── types/                # TS Definitions
└── utils/                # Helpers
```

## UI Architecture & Design System
*   **Design System**: Hospyn Design System (HDS). A strict set of design tokens (colors, spacing, typography) synced via Figma Tokens.
*   **Theme System**: Native Dark Mode support. Enterprise hospitals can white-label with primary/secondary color overrides injected via CSS variables.
*   **Accessibility (a11y)**: WCAG 2.1 AA compliance. Aria-labels on all inputs, screen-reader focus traps in modals, and high-contrast text ratios.
*   **Responsive Design**: Fluid typography. Breakpoints at `sm: 640px` (Mobile), `md: 768px` (Tablet/Reception terminals), `lg: 1024px` (Laptops), `xl: 1280px` (Desktop).

## Offline Mode & Caching Strategy
*   **Mobile (Patient App)**: Uses `AsyncStorage` + `React Query` persister. Critical data (Health ID, emergency contacts, latest prescriptions) is cached locally. If offline, the app displays a banner but remains usable. Modifying actions are queued in SQLite and synced when connectivity returns.
*   **Web (Doctor/Staff)**: Assumes constant connectivity, but React Query heavily caches standard lists (medicines, ICD-10 codes) to minimize payload overhead.

---

# SECTION 6 — BACKEND BLUEPRINT

The backend utilizes an API Gateway pattern routing to specialized microservices. All services are stateless and horizontally scalable via GCP Cloud Run.

## 1. API Gateway (Nginx)
*   **Responsibilities**: TLS Termination, HSTS enforcement, IP Blacklisting, Global Rate Limiting, Cross-Origin Resource Sharing (CORS) pre-flight handling, and reverse proxy routing.
*   **Routing Rule**: `/api/v1/auth/*` → `auth_service:8001`, `/api/v1/healthcare/*` → `healthcare_core:8002`.
*   **Scaling**: Cloud Load Balancer in front of Nginx (if deployed on VMs), or native Cloud Run routing in serverless mode.

## 2. Auth Service (Python/FastAPI)
*   **Responsibilities**: The strictly isolated identity provider. Manages passwords, issues JWTs, handles OTP delivery and verification. 
*   **Data Isolation**: This service is the *only* service allowed to read/write the `users`, `otp_verifications`, and `password_reset_tokens` tables.
*   **Scaling Strategy**: Highly scalable. Heavy bcrypt operations can be offloaded to worker threads.
*   **Events Published**: `user.created`, `user.logged_in`, `user.token_version_bumped`.

## 3. Healthcare Core Service (Python/FastAPI)
*   **Responsibilities**: The massive "Monolithic Core" handling Hospitals, Doctors, Patients, Appointments, Records, Walk-in Queues, and Staff.
*   **Data Protection**: Applies AES-256 Fernet encryption/decryption at the SQLAlchemy ORM layer for all PHI (Protected Health Information).
*   **Idempotency**: Uses `X-Idempotency-Key` headers coupled with Redis to prevent duplicate operations (e.g., duplicate payments or duplicate queue entries) during network retries.
*   **Scaling Strategy**: Connection pooling (PgBouncer) is critical because this service maintains high concurrent connections. 

## 4. Pharmacy Service [NEW] (Python/FastAPI)
*   **Responsibilities**: Inventory management, supplier Purchase Orders (POs), stock tracking, expiry alerts, and POS execution.
*   **APIs**: CRUD for `medicines`, `inventory_batches`. Endpoints for dispensing prescriptions and processing POS transactions.
*   **Events Consumed**: `appointment.prescription_issued` (to pre-fill pharmacy queue).
*   **Databases**: PostgreSQL (Dedicated Schema/Tables).

## 5. Lab Service [NEW] (Python/FastAPI)
*   **Responsibilities**: Managing lab test catalogs, tracking sample collection (phlebotomy), recording results, and generating PDF reports.
*   **APIs**: CRUD for `lab_tests`. Endpoints for updating sample status (`collected`, `processing`, `completed`).
*   **Events Published**: `lab.report_ready` (triggers notifications).
*   **Databases**: PostgreSQL, Cloud Storage (for raw analyzer dumps and generated PDFs).

## 6. Billing Service [NEW] (Python/FastAPI)
*   **Responsibilities**: OPD/IPD invoice generation, payment gateway webhooks (Razorpay), refund processing, and GST tax calculation.
*   **APIs**: `/invoices/generate`, `/payments/webhook`, `/refunds`.
*   **Scaling Strategy**: Extreme fault-tolerance required. Uses distributed locks (Redis) to prevent double-billing.

## 7. Notification Service [NEW] (Go or Python)
*   **Responsibilities**: Async delivery of SMS (Twilio), Email (SendGrid), and Push Notifications (Firebase/Expo).
*   **Architecture**: Consumer pulling from a Redis or Pub/Sub queue. Ensures main APIs are not blocked by slow SMTP/SMS gateways.
*   **Error Handling**: Exponential backoff retries and Dead Letter Queues (DLQ) for failed messages.

## 8. AI Service [NEW] (Python/FastAPI)
*   **Responsibilities**: Wraps Google Vertex AI / Gemini API. Provides endpoints for symptom checking, medical text summarization, and Chatbot responses.
*   **Architecture**: Streams responses back to the client using Server-Sent Events (SSE). 

## 9. Analytics Service [NEW] (Python)
*   **Responsibilities**: Batch aggregations, daily cron jobs, and proxying dashboard queries to BigQuery.

---

# SECTION 7 — DATABASE MASTER PLAN

## 1. PostgreSQL (Primary OLTP)
**Version**: 15 (Alpine)
**Purpose**: Absolute source of truth. ACID compliance guarantees consistency for clinical and financial data.

### 1.1 Existing Core Tables (Abbreviated Specs)
*   **users**: `id` (UUID), `email` (Unique), `hashed_password`, `role`, `token_version` (Integer, used for mass revocation), `is_active`.
*   **patients**: `id` (UUID), `user_id` (Unique index), `hospital_id`, `first_name`, `last_name`, `phone`, `date_of_birth`, **PHI fields** (`known_allergies`, `chronic_conditions` — EncryptedText type).
*   **doctors**: `id` (UUID), `user_id`, `hospital_id`, `specialization`, `medical_license_number` (Unique).
*   **hospitals**: `id`, `name`, `registration_number`, `status` (Enum).
*   **appointments**: `id`, `patient_id`, `doctor_id`, `scheduled_at`, `status` (Enum), `clinical_notes` (EncryptedText), `prescription` (EncryptedText), `diagnosis` (EncryptedText).
*   **walkin_requests**: `id`, `hospital_id`, `patient_id` (Nullable), `queue_state` (Enum), `priority_level`, `triage_vitals_json`.
*   **medical_records**: `id`, `patient_id`, `file_url`, `ai_summary`.
*   **staff**: `id`, `user_id`, `hospital_id`, `role` (Enum), `shift_status`.

### 1.2 NEW Tables Needed (Schema Additions)
*   **medicines**: `id`, `brand_name`, `generic_name`, `manufacturer`, `hsn_code`.
*   **inventory_batches**: `id`, `hospital_id`, `medicine_id`, `batch_number`, `expiry_date`, `quantity`, `mrp`.
*   **lab_tests**: `id`, `hospital_id`, `test_name`, `loinc_code`, `price`, `normal_range_json`.
*   **lab_samples**: `id`, `appointment_id`, `patient_id`, `test_id`, `status` (collected, processing, completed), `result_value`.
*   **invoices**: `id`, `hospital_id`, `patient_id`, `appointment_id`, `total_amount` (paise), `tax_amount`, `status` (paid, pending, void).
*   **invoice_items**: `id`, `invoice_id`, `description`, `quantity`, `unit_price`.

### 1.3 Indexing & Partitioning Strategy
*   **Indexes**: B-Tree indexes on all Foreign Keys, `email`, `phone`, and heavily queried enums (e.g., `queue_state` and `hospital_id` composite index on `walkin_requests`).
*   **Partitioning**: `audit_logs` and `queue_events` grow infinitely. They must be partitioned by RANGE on `created_at` (e.g., 1 partition per quarter).
*   **Archiving**: Data older than 7 years (regulatory requirement) is pg_dumped to cold GCS storage and deleted from the active DB to save disk IOPS.
*   **Backup & Recovery**: Automated daily Cloud SQL snapshots. Point-in-Time Recovery (PITR) enabled allowing rollback to any specific second within the last 7 days. Recovery Time Objective (RTO) is 15 minutes.

## 2. Redis (In-Memory Datastore)
**Version**: 7
*   **Token Blacklisting (DB 0)**: When a user logs out, their JWT `jti` (Token ID) is stored here with an expiration matching the token's remaining lifespan. Fast O(1) lookup on every API request.
*   **User State Cache (DB 1)**: Caches `is_active` and `token_version` for every user ID to avoid hitting PostgreSQL on every single authenticated request.
*   **Rate Limiting**: Sliding window implementation storing IP addresses and request counts.
*   **Future Pub/Sub**: Will be used to broadcast queue updates (e.g., token 42 is next) to WebSocket servers connected to Reception/Doctor apps.

## 3. ElasticSearch [NEW]
**Purpose**: Powerful full-text search and typo-tolerance.
*   **Indexes**:
    *   `patients_idx`: Search by name, partial phone number, health ID.
    *   `medicines_idx`: Autocomplete for doctors prescribing drugs (handles brand name vs generic name complexity).
*   **Sync Mechanism**: PostgreSQL triggers or CDC (Debezium) pushing changes to ElasticSearch.

## 4. Google Cloud Storage (GCS)
**Purpose**: Highly durable object storage for files.
*   **Buckets**:
    *   `hospyn-medical-records-prod`: Highly restricted. Requires Signed URLs generated by the Backend (valid for 10 minutes) for any read/write.
    *   `hospyn-public-assets`: Public bucket for hospital logos, doctor avatars.
*   **Lifecycle**: Auto-transition to Nearline storage after 1 year, Coldline after 3 years.

## 5. BigQuery (Data Warehouse)
**Purpose**: Offload analytical queries so the primary PostgreSQL DB is not impacted.
*   **Schema**: Star schema. Fact tables (`fact_consultations`, `fact_billing`) linked to Dimension tables (`dim_hospitals`, `dim_date`, `dim_patients`).
*   **ETL**: Daily batch jobs via Cloud Dataflow extracting data from PostgreSQL, transforming it, and loading it into BigQuery.

## 6. Vertex AI Vector Store
**Purpose**: Semantic search and Retrieval-Augmented Generation (RAG).
*   **Mechanism**: When a medical record is uploaded, the AI Service extracts the text, generates vector embeddings using Google's `text-embedding-004` model, and stores them here.
*   **Use Case**: Chitti AI can query the vector store to answer complex patient questions like "When was my last tetanus shot?" by finding the semantically relevant medical record chunk.
