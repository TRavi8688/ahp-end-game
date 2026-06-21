# HOSPYN ULTIMATE CTO TECHNICAL BLUEPRINT
## PART 4: DEVOPS, CLOUD INFRASTRUCTURE, SECURITY, AND OBSERVABILITY

---

# SECTION 12 — DEVOPS ARCHITECTURE

Hospyn embraces a "Shift-Left" DevOps culture. Infrastructure is defined as code (Terraform), and all deployments are fully automated via GitHub Actions, eliminating manual human errors.

## 12.1 Environment Strategy
1.  **Local (Developer Machine)**: `docker-compose.yml` spins up PostgreSQL, Redis, Auth Service, Healthcare Core, and an Nginx reverse proxy. Local testing mirrors production networking.
2.  **Testing (Ephemeral)**: PRs trigger isolated DB instances and Cloud Run revisions. Destroyed upon merge.
3.  **Staging (Pre-Prod)**: A complete, scaled-down mirror of production connected to anonymized staging databases. Used for UAT and final QA sign-off.
4.  **Production**: Multi-zone, highly available architecture deployed to Google Cloud Platform (GCP).

## 12.2 CI/CD Pipeline Flow
*Tooling: GitHub Actions*
1.  **Code Push**: Triggers workflow.
2.  **Lint & Security Scan**: `ruff` (linting), `mypy` (type checking), `bandit` (SAST security scanning), `gitleaks` (secret detection). Pipeline fails instantly if any fail.
3.  **Unit & Integration Tests**: `pytest` runs against an ephemeral PostgreSQL service container. Coverage must exceed 85%.
4.  **Build**: Docker images are built and tagged with the Git commit SHA.
5.  **Push**: Images pushed to GCP Artifact Registry.
6.  **Database Migration**: Alembic applies `upgrade head` to the target database.
7.  **Deploy**: Cloud Run revision updated with the new image.
8.  **Smoke Test**: Automated HTTP calls verify `/health` endpoints.
9.  **Traffic Shift**: In production, traffic is shifted 10% -> 50% -> 100% (Canary Release).

## 12.3 Rollback Flow
If production smoke tests fail, or error rates spike (detected via Cloud Monitoring alerts), the CD pipeline executes an automatic rollback by shifting 100% of traffic back to the previous stable Cloud Run revision. Database rollbacks (Alembic downgrades) are strictly manual and require CTO approval due to data loss risks.

---

# SECTION 13 — CLOUD INFRASTRUCTURE

Hospyn is exclusively hosted on **Google Cloud Platform (GCP)** in the `asia-south1` (Mumbai) region to ensure low latency for Indian hospitals and strict compliance with the DPDP Act (data residency).

## 13.1 Core GCP Services
*   **Compute**: **Cloud Run**. Serverless containers automatically scale from 1 to 100 instances based on CPU utilization and request concurrency. Zero maintenance OS layer.
*   **Database**: **Cloud SQL for PostgreSQL**. Configured for High Availability (regional multi-zone replication). Point-in-Time Recovery enabled.
*   **Cache**: **Memorystore for Redis**. Standard Tier (HA enabled) for sub-millisecond token verification and rate limiting.
*   **Storage**: **Cloud Storage (GCS)**. Buckets with Customer-Managed Encryption Keys (CMEK) for medical records.
*   **Networking**: **Global HTTP(S) Load Balancer** sitting in front of Cloud Run. **Cloud CDN** caches static frontend assets at the edge. **Cloud Armor** (WAF) blocks SQLi, XSS, and DDoS attacks at the perimeter.
*   **Secrets**: **Secret Manager**. No environment variables containing secrets are ever stored in code or CI configs. Cloud Run pulls them directly from Secret Manager at runtime.

## 13.2 High Availability & Disaster Recovery
*   **Redundancy**: Cloud SQL and Memorystore are deployed in Regional HA mode. If a GCP zone goes down, failover occurs automatically within ~30 seconds.
*   **Disaster Recovery (DR)**: Daily backups of PostgreSQL are replicated to `asia-south2` (Delhi). In the event of a total region failure, infrastructure can be redeployed via Terraform to the DR region, and data restored. RPO (Recovery Point Objective): 1 minute. RTO (Recovery Time Objective): 15 minutes.

---

# SECTION 14 — SECURITY ARCHITECTURE

Security is mathematical, not procedural. Hospyn operates on a Zero-Trust architecture.

## 14.1 Encryption Strategy
*   **In Transit**: TLS 1.3 enforced at the Load Balancer. Internal service-to-service communication within the VPC is also encrypted.
*   **At Rest (Infrastructure)**: All Cloud SQL disks and GCS buckets are encrypted using Google's AES-256 infrastructure.
*   **At Rest (Application-Level PHI)**: Highly sensitive fields (e.g., `known_allergies`, `clinical_notes`, `prescription`) use Application-Layer Encryption. The FastAPI backend encrypts the string using a Fernet AES-256 key *before* sending the INSERT query to PostgreSQL. Even if a DBA dumps the raw database, the clinical text is ciphertext.

## 14.2 Network Isolation & WAF
*   **VPC Flow**: Cloud Run services are connected to a Serverless VPC Access Connector. Cloud SQL and Redis only have internal IP addresses. They are unreachable from the public internet.
*   **Cloud Armor**: Blocks traffic from known malicious IPs (Threat Intelligence), rate-limits brute force login attempts, and drops malformed HTTP packets.

## 14.3 Cryptographic Audit Chaining
Traditional audit logs can be tampered with by a malicious insider. Hospyn uses an immutable chain.
*   Every time an Appointment or Medical Record is altered, a row is added to `audit_logs`.
*   The `signature` column is calculated as: `HMAC-SHA256(SecretKey, PreviousRowHash + CurrentRowData)`.
*   If a rogue admin deletes or modifies a row in the database directly, the cryptographic chain is broken, and a background verification script instantly alerts the security team.

## 14.4 Compliance Posture
*   **DPDP Act (India)**: Compliant. Data residency in Mumbai. Explicit patient consent capture mechanisms built into the API. Right to Erasure implemented via the `/account/delete` cascading endpoint.
*   **HIPAA**: Ready. BAA (Business Associate Agreement) signed with Google Cloud. Audit logging, encryption, and strict RBAC satisfy all technical safeguards.

---

# SECTION 15 — OBSERVABILITY

You cannot fix what you cannot see. Hospyn implements full-stack observability.

## 15.1 Structured Logging
*   We use `structlog` to output all logs in JSON format.
*   *Correlation IDs*: The Nginx gateway generates an `X-Request-ID`. This ID is injected into every log line across Auth and Healthcare services, allowing developers to trace a single user's request across the entire microservice boundary.
*   *PII Masking*: The logging middleware uses regex to automatically mask phone numbers, emails, and Aadhaar numbers before they hit the console. Logs are shipped to GCP Cloud Logging.

## 15.2 Metrics & Monitoring
*   **Prometheus**: Scrapes `/metrics` endpoints from all FastAPI apps.
*   **Grafana Dashboards**: Visualizes the RED metrics (Rate, Errors, Duration) for every API endpoint. 
*   **Business Metrics**: We track custom Prometheus gauges for "Active Consultations", "Queue Wait Times", and "Prescriptions Generated".

## 15.3 Alerting & SLAs
*   **P0 (Critical)**: Auth service down, DB latency > 500ms, Error rate > 1%. Triggers PagerDuty to wake up the on-call engineer.
*   **P1 (High)**: AI service degraded, high memory usage in Redis. Slack alert to engineering channel.
*   **SLA Target**: 99.9% uptime (Max 43.8 minutes of downtime per month).

---

# SECTION 16 — TESTING STRATEGY

Hospyn enforces a strict Test Automation Pyramid. Manual QA is reserved only for complex UX flows.

## 16.1 Testing Layers
1.  **Unit Tests (70%)**: `pytest` tests isolated functions (e.g., JWT signing, priority queue sorting logic). Extremely fast. Mocks database calls using `pytest-mock`.
2.  **Integration Tests (20%)**: Uses `httpx.AsyncClient` connected to a real, ephemeral PostgreSQL instance spun up in Docker. Tests actual API endpoints and database constraints (e.g., testing that the Walk-in Queue duplicate prevention logic successfully rejects identical phone numbers at the same hospital).
3.  **End-to-End (E2E) Tests (10%)**: Uses `Playwright` to drive the actual Web browser. Tests the critical path: *Receptionist Registers Patient -> Nurse Triages -> Doctor Prescribes*.

## 16.2 Security & Chaos Testing
*   **Red Team Adversarial Testing**: We maintain a suite of scripts (`scripts/red_team/`) that continuously attempt to break RBAC rules (e.g., trying to fetch Hospital B's data using Hospital A's token). These run nightly.
*   **Chaos Engineering**: `chaos_simulation.py` randomly kills the Redis container or spikes CPU usage in the test environment to ensure the FastAPI fallback logic and retry decorators work under duress.
