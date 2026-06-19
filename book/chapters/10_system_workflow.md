# Chapter 10: System Workflow

## 10.1 Mission-Critical Operation Sequences
Hospyn 2.0 is defined by how its components interact under pressure. This chapter breaks down the five core workflows.

## 10.2 Workflow: User Login
This secure handshake ensures identity and scope.
```mermaid
sequenceDiagram
    participant U as Client
    participant A as FastAPI API
    participant D as Postgres DB
    participant R as Redis Cache

    U->>A: POST /auth/login {email, pass}
    A->>D: SELECT * FROM users WHERE email=?
    D-->>A: User Record (Hashed Pass)
    A->>A: Verify Hash (Bcrypt)
    A->>R: Set Active Session Token
    A-->>U: 200 OK + JWT {Access, Refresh}
```

## 10.3 Workflow: Protected API Request Flow
How every data retrieval is guarded.
```mermaid
sequenceDiagram
    participant U as Client
    participant M as Security Middleware
    participant S as Service Layer
    participant D as Postgres DB

    U->>M: GET /patient/profile (JWT)
    M->>M: Validate JWT Signature
    M->>S: FetchProfile(user_id)
    S->>D: Query Profile Table
    D-->>S: Raw Data (Encrypted)
    S->>S: Decrypt PII (Fernet)
    S-->>U: JSON Response
```

## 10.4 Workflow: Data Processing & Aggregation
How the dashboard stays accurate.
```mermaid
sequenceDiagram
    participant A as API / Worker
    participant S as DashboardService
    participant D as Postgres DB
    participant R as Redis

    A->>S: Trigger Aggregation(patient_id)
    S->>D: Multiple SELECT (Records, Conditions, Meds)
    D-->>S: Data Sets
    S->>S: Compute Summary Stats
    S->>D: UPDATE patient_dashboards
    S->>R: Cache JSON View
```

## 10.5 Workflow: Secure File Upload
```mermaid
sequenceDiagram
    participant U as Client
    participant A as FastAPI API
    participant S3 as Storage (S3/Local)
    participant D as Postgres DB

    U->>A: POST /medical-records (Form-Data)
    A->>A: Verify Magic Bytes (Mime)
    A->>S3: PutObject(UUID_filename)
    S3-->>A: Upload Confirmed
    A->>D: INSERT INTO medical_records (file_url)
    A-->>U: 201 Created {record_id}
```

## 10.6 Workflow: AI Neural Processing Pipeline
The most complex flow in the platform.
```mermaid
sequenceDiagram
    participant A as FastAPI API
    participant R as Redis (ARQ Queue)
    participant W as ARQ Worker
    participant LH as LLM Hub (Groq/Gemini)
    participant WS as WebSocket Manager

    A->>R: Push Task: process_doc(id)
    R->>W: Pull Task
    W->>LH: OCR Content Extraction
    LH-->>W: Raw Text
    W->>LH: Summarize for Patient/Doctor
    LH-->>W: Clinical JSON
    W->>A: Commit to Record DB
    W->>R: Publish Event: ANALYZED
    R->>WS: Trigger Broadcast
    WS-->>A: Notify Client over WebSocket
```
