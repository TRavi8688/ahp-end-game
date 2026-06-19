# Hospyn Deployment Architecture

## Service Split

Hospyn uses a hybrid deployment model: backends run on Docker / Google Cloud Run,
frontends are deployed to Firebase Hosting.

---

## Backend (Docker Compose / Google Cloud Run)

These services are containerised and run as Docker containers locally,
and on Google Cloud Run in production:

| Service | Port (internal) | Description |
|---|---|---|
| `nginx` | 80, 443 | Reverse proxy, TLS termination, rate limiting |
| `gateway` | 8000 | API gateway — proxies all requests to microservices |
| `auth-service` | 8001 | Authentication, JWT issuance, RBAC |
| `healthcare-core` | 8002 | Patient records, appointments, clinical data |
| `ai-service` | 8003 | AI/LLM features (Gemini, Groq) |
| `postgres` | 5432 (internal only) | Primary PostgreSQL database |
| `pgbouncer` | 5432 (internal only) | Connection pooler in front of Postgres |
| `redis` | 6379 (internal only) | Session store, OTP cache, rate limiting |

All external traffic enters through **nginx on ports 80 and 443**.
The gateway and microservice ports are NOT exposed to the host in production.

### Local Development

```bash
cp .env.example .env
# Fill in required values (see .env.example for instructions)
docker-compose up --build
```

Access the API at `https://localhost` (self-signed cert in dev — expect a browser warning).

### Production (Cloud Run)

Each microservice is built and deployed as a Cloud Run service via the
GitHub Actions workflow in `.github/workflows/deploy.yml`.

Cloud Run services communicate via internal VPC. The gateway is the only
service with a public Cloud Run URL, and even that is fronted by a GCP
Load Balancer with a GCP-managed SSL certificate.

---

## Frontend (Firebase Hosting)

The following frontends are deployed to Firebase Hosting as static builds:

| App | Firebase project | Description |
|---|---|---|
| `hospyn-v2-web/` | `hospyn-v2` | Main patient-facing web app |
| `doctor-app/` | `hospyn-doctor` | Doctor portal |
| `patient-app/` | `hospyn-patient` | Patient mobile web app |
| `partner-app/` | `hospyn-partner` | Partner organisation portal |
| `pharma-mobile-app/` | `hospyn-pharma` | Pharmacy partner mobile app |
| `super-admin-dashboard/` | `hospyn-admin` | Super admin control panel |
| `hr-portal/` | `hospyn-hr` | HR management portal |
| `staff-portal/` | `hospyn-staff` | Hospital staff portal |

Firebase Hosting configuration is in `firebase.json` and `.firebaserc`.

### Frontend to Backend Connection

All frontends connect to the backend gateway via the `REACT_APP_API_URL` /
`VITE_API_BASE_URL` environment variable set at build time:

- **Development:** `http://localhost:8000` (direct to gateway, bypassing nginx)
  or `https://localhost` (through nginx)
- **Production:** `https://api.hospyn.com` (GCP Load Balancer → Cloud Run gateway)

The gateway handles CORS — set `ALLOWED_ORIGINS` to the Firebase Hosting
domain(s) for your project (e.g. `https://hospyn-v2.web.app,https://app.hospyn.com`).

### Deploy a Frontend

```bash
cd hospyn-v2-web/
npm run build
firebase deploy --only hosting:hospyn-v2
```

---

## Secrets Management

- **Local dev:** `.env` file (gitignored — copy from `.env.example`)
- **CI/CD:** GitHub Actions secrets (set in repo Settings → Secrets)
- **Production Cloud Run:** GCP Secret Manager — secrets injected at runtime

Never commit secrets to this repository. See `.env.example` for the full list
of required variables and how to generate them.

---

## First Deploy Checklist

See the `POST-FIX GIT COMMANDS` and `FIRST DEPLOY CHECKLIST` sections in
`AUDIT_FIXES.md` for the exact sequence of steps required for initial deployment.
