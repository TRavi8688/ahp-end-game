# Hospyn 2.0 Enterprise Technical Architecture

This document provides a deep-dive into the hardened backend and database architecture of the Hospyn 2.0 platform.

---

## 1. Backend Service Architecture
The backend is built on **FastAPI** using an asynchronous (non-blocking) I/O model. It follows a strict **Layered Architecture** to ensure separation of concerns and production scalability.

### Request Lifecycle Diagram
```mermaid
sequenceDiagram
    participant C as Client (Mobile/Web)
    participant M as Middleware (Security/Tracing)
    participant R as Router (API Layer)
    participant S as Service Layer (Business Logic)
    participant D as Data Access (Repository)
    participant DB as PostgreSQL / Redis

    C->>M: HTTP Request (with X-Idempotency-Key)
    M->>M: Trace-ID Generation & IP Blacklist Check
    M->>DB: Acquire Redis Distributed Lock
    M->>R: Route Request
    R->>S: Invoke Business Logic
    S->>D: CRUD Operations
    D->>DB: PostgreSQL Atomic Transaction
    S->>DB: Log HMAC-Chained Audit Action
    S->>R: Return Response
    R->>M: Response Serialization
    M->>DB: Cache Response in Redis (Replay Logic)
    M->>C: 200 OK / Response Body
```

### Core Components
- **API Layer**: FastAPI routers enforcing Pydantic schemas for input validation.
- **Service Layer**: Handles multi-step operations (e.g., Clinical Analysis, Identity Management).
- **Security Middleware**: 
    - **Identity**: JWT with HS256 validation.
    - **Throttling**: Distributed sliding-window rate limiting.
    - **Containment**: Adaptive IP blacklisting.
- **Observability**: Prometheus SLI exporters (Latency, Error Rates, Throughput).

---

## 2. Database Architecture (SOT)
The system utilizes a single **PostgreSQL** instance as the Source of Truth, augmented by **Redis** for transient state and distributed synchronization.

### Entity Relationship & Security Schema
```mermaid
erDiagram
    USER ||--|| PATIENT : "user_id"
    USER ||--o| DOCTOR : "user_id"
    PATIENT ||--o{ MEDICAL_RECORD : "owns"
    MEDICAL_RECORD ||--o{ AUDIT_LOG : "triggers"
    
    USER {
        int id PK
        string email UK
        string hashed_password
        string role
        datetime last_login
    }

    PATIENT {
        int id PK
        string hospyn_id UK
        string phone_number "AES-GCM Encrypted"
        string blood_group
        int version_id "OCC Lock"
    }

    MEDICAL_RECORD {
        int id PK
        int patient_id FK
        string type
        text raw_text "AES-GCM Encrypted"
        string file_url
        int version_id "OCC Lock"
    }

    AUDIT_LOG {
        int id PK
        string action
        jsonb details "PII Masked"
        string signature "HMAC-SHA256 Chain"
        string prev_hash "Link to Prev Row"
    }
```

### Enterprise Integrity Features
1.  **Optimistic Concurrency Control (OCC)**:
    - Every critical table contains a `version_id`. 
    - Updates are enforced with: `WHERE id = :id AND version_id = :old_version`.
    - Prevents data corruption during simultaneous clinical edits.

2.  **Field-Level Encryption (At Rest)**:
    - Sensitive fields (Phone, Medical Text) use **AES-GCM Authenticated Encryption**.
    - Each field has a unique 12-byte IV (nonce).
    - Supports **Key Rotation** via a secondary key pool.

3.  **Cryptographic Audit Chaining**:
    - Every log entry is signed: `HMAC(Secret, Prev_Hash + Current_Data)`.
    - This creates an immutable ledger where row deletion or modification is mathematically detectable.

4.  **Distributed Idempotency**:
    - Redis-backed response replay for `/upload` and `/payment` endpoints.
    - Ensures that network retries do not create duplicate clinical records.
