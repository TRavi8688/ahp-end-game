# Line-by-Line Audit Report

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\alembic\versions\20260605_add_performance_indexes.py (from phase-1)
```diff
--- PHASE: 20260605_add_performance_indexes.py
+++ REPO: 20260605_add_performance_indexes.py
@@ -1 +1 @@
-"""add performance indexes
+"""add_performance_indexes
@@ -3,3 +3,3 @@
-Revision ID: c3d5f7a9b2e4
-Revises: b2c4e6f8a1d3
-Create Date: 2026-06-05
+Revision ID: add_performance_indexes
+Revises: dpdp_compliance_tables
+Create Date: 2026-06-05 00:00:02.000000
@@ -7,3 +6,0 @@
-Adds missing composite and single-column indexes for high-frequency
-query patterns identified in production profiling. Covers appointment
-scheduling, patient lookups, billing queries, and soft-delete filters.
@@ -12,2 +9 @@
-from sqlalchemy import text
-from sqlalchemy.exc import ProgrammingError
+import sqlalchemy as sa
@@ -15,3 +11,2 @@
-# revision identifiers, used by Alembic.
-revision = 'c3d5f7a9b2e4'
-down_revision = 'b2c4e6f8a1d3'
+revision = 'add_performance_indexes'
+down_revision = 'dpdp_compliance_tables'
@@ -21,28 +15,0 @@
-# Indexes defined as (index_name, table_name, columns) for DRY iteration
-_...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\alembic\versions\20260605_dpdp_compliance_tables.py (from phase-1)
```diff
--- PHASE: 20260605_dpdp_compliance_tables.py
+++ REPO: 20260605_dpdp_compliance_tables.py
@@ -1 +1 @@
-"""dpdp compliance tables
+"""dpdp_compliance_tables
@@ -3,3 +3,3 @@
-Revision ID: b2c4e6f8a1d3
-Revises: a7f3e9c21b84
-Create Date: 2026-06-05
+Revision ID: dpdp_compliance_tables
+Revises: phase3_patient_device_tokens
+Create Date: 2026-06-05 00:00:01.000000
@@ -7,2 +6,0 @@
-Digital Personal Data Protection (DPDP) Act 2023 compliance tables.
-Implements right to erasure, consent tracking, and breach notification.
@@ -14,3 +12,2 @@
-# revision identifiers, used by Alembic.
-revision = 'b2c4e6f8a1d3'
-down_revision = 'a7f3e9c21b84'
+revision = 'dpdp_compliance_tables'
+down_revision = 'phase3_patient_device_tokens'
@@ -20 +16,0 @@
-
@@ -22,26 +18,6 @@
-    # Consent records — DPDP §6: explicit, informed, granular consent
-    op.create_table(
-        'consent_records',
-        sa.Column(
-            'id',
-            postgresql.UUID(as_uuid=True),
-            primary_key=True,
-...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\alembic\versions\20260605_phase3_patient_device_tokens.py (from phase-1)
```diff
--- PHASE: 20260605_phase3_patient_device_tokens.py
+++ REPO: 20260605_phase3_patient_device_tokens.py
@@ -1 +1 @@
-"""phase3 patient device tokens
+"""phase3_patient_device_tokens
@@ -3 +3 @@
-Revision ID: a7f3e9c21b84
+Revision ID: phase3_patient_device_tokens
@@ -5 +5 @@
-Create Date: 2026-06-05
+Create Date: 2026-06-05 00:00:00.000000
@@ -12,2 +12 @@
-# revision identifiers, used by Alembic.
-revision = 'a7f3e9c21b84'
+revision = 'phase3_patient_device_tokens'
@@ -17,0 +17,15 @@
+def upgrade() -> None:
+    # ── patient_device_tokens ─────────────────────────────────────────────
+    op.create_table(
+        "patient_device_tokens",
+        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
+                  server_default=sa.text("gen_random_uuid()")),
+        sa.Column("patient_id", postgresql.UUID(as_uuid=True),
+                  sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
+        sa.Column("token", sa.Text, nullable=False),
+        sa...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\MIGRATION_STRATEGY.md (from phase-1)
```diff
--- PHASE: MIGRATION_STRATEGY.md
+++ REPO: MIGRATION_STRATEGY.md
@@ -4,6 +4 @@
-
-Hospyn uses PostgreSQL with **separate databases per microservice**. During the
-monolith → microservices transition the root `/alembic/` chain runs against the
-shared `hospyn` database. Once all services are stable it will be deprecated.
-
----
+Hospyn uses PostgreSQL with separate databases per microservice.
@@ -14,16 +9,4 @@
-
-| Property | Value |
-|---|---|
-| **Database** | `hospyn` (main) |
-| **Status** | Active during transition. Deprecated once microservices stabilise. |
-| **Run** | From repo root: `alembic upgrade head` |
-| **Chain head** | `c3d5f7a9b2e4` (add_performance_indexes) |
-
-Full tail of chain added in this release:
-
-```
-f1e2d3c4b5a6  ← previous head
-  └→ a7f3e9c21b84  phase3_patient_device_tokens
-     └→ b2c4e6f8a1d3  dpdp_compliance_tables
-        └→ c3d5f7a9b2e4  add_performance_indexes  ← NEW HEAD
-```
+- **Database**: hospyn (main)
+- **Status**: Active during transitio...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\verify_migrations.sh (from phase-1)
```diff
--- PHASE: verify_migrations.sh
+++ REPO: verify_migrations.sh
@@ -1,228 +1,7 @@
-#!/usr/bin/env bash
-# verify_migrations.sh
-# Verifies the root Alembic migration chain is linear (no branches/orphans)
-# and that all new migrations are syntactically valid Python.
-# Usage: bash verify_migrations.sh [/path/to/alembic/versions]
-# Exit codes: 0 = all good, 1 = problems found
-
-set -euo pipefail
-
-VERSIONS_DIR="${1:-alembic/versions}"
-PASS=0
-FAIL=1
-status=$PASS
-
-RED='\033[0;31m'
-GREEN='\033[0;32m'
-YELLOW='\033[1;33m'
-NC='\033[0m'
-
-ok()   { echo -e "  ${GREEN}✓${NC}  $*"; }
-warn() { echo -e "  ${YELLOW}!${NC}  $*"; }
-err()  { echo -e "  ${RED}✗${NC}  $*"; status=$FAIL; }
-
-echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
-echo "  Hospyn Migration Chain Verifier"
-echo "  Scanning: $VERSIONS_DIR"
-echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
-
-# ── 1. Python syntax check on every migration file ──────────────────────────
-echo ""
-echo "▶ Step 1: Synt...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\notification-service\main.py (from phase-2)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\notification-service\notifications.py (from phase-2)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\notification-service\notification_service.py (from phase-2)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\notification-service\sms_service.py (from phase-2)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\auth-service\app\api\v1\auth.py (from phase-3)
```diff
--- PHASE: auth.py
+++ REPO: auth.py
@@ -2,9 +2 @@
-Authentication endpoints with rate limiting.
-
-Rate limits (per IP via slowapi + per phone number via Redis):
-  /register       — 3 req/min  (prevent account spam)
-  /login          — 10 req/min (allow reasonable retries, block brute force)
-  /otp-request    — 5 req/min  (OTP SMS cost + abuse prevention)
-  /otp-verify     — 10 req/min (allow retry on typo, block enumeration)
-
-User-level OTP limit: max 5 OTPs per phone number per hour (tracked in Redis).
+Authentication endpoints with rate limiting and SEC-7 httpOnly cookies.
@@ -17 +9,3 @@
-from fastapi import APIRouter, Depends, HTTPException, Request, status
+from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
+from fastapi.security import OAuth2PasswordRequestForm
+from sqlalchemy.orm import Session
@@ -20 +14,8 @@
-from app.core.deps import get_redis
+from app.core.database import get_db
+# Assuming these are available, or else dummy out for the...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\.github\workflows\deploy.yml (from phase-3)
```diff
--- PHASE: deploy.yml
+++ REPO: deploy.yml
@@ -1 +1 @@
-name: Hospyn CI/CD Pipeline
+name: CI / CD
@@ -5 +5 @@
-    branches: [main, staging]
+    branches: [main]
@@ -9,4 +8,0 @@
-env:
-  REGISTRY: gcr.io
-  REGION: asia-south1
-
@@ -14,3 +10 @@
-  # ─────────────────────────────────────────────
-  # JOB 1: Lint & Static Analysis
-  # ─────────────────────────────────────────────
+
@@ -18,5 +12,4 @@
-    name: Lint & Static Analysis
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4
-
+    name: Lint & Security Scan
+    runs-on: ubuntu-22.04
+    steps:
+      - uses: actions/checkout@v4
@@ -27,4 +20,2 @@
-
-      - name: Install ruff
-        run: pip install ruff
-
+      - name: Install dev tools
+        run: pip install ruff bandit
@@ -32,12 +23,4 @@
-        run: ruff check backend/
-        continue-on-error: true  # Linting is informational — does NOT block deployment
-
-      - name: Security scan (fail on HIGH severity)
-        run: |
-          pip...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\auth-service\app\main.py (from phase-3)
```diff
--- PHASE: main.py
+++ REPO: main.py
@@ -7 +6,0 @@
-- Prometheus metrics
@@ -13,0 +13 @@
+import os
@@ -51 +51 @@
-    _configure_cors(application)
+    configure_cors(application)
@@ -57,3 +57,3 @@
-def _configure_cors(application: FastAPI) -> None:
-    """CORS is intentionally strict — must match auth endpoint expectations."""
-    import os
+def configure_cors(application: FastAPI) -> None:
+    """
+    SEC-5 FIX: CORS is configured from an explicit allowlist env var.
@@ -60,0 +61,4 @@
+    NEVER use a wildcard. If ALLOWED_ORIGINS is empty at startup, raise
+    an error immediately so misconfigurations are caught before traffic reaches
+    the service — not silently discovered after a breach.
+    """
@@ -64,13 +68,7 @@
-        if os.environ.get("DOCKER_ENV") == "true" and settings.ENV != "production":
-            raw_origins = "http://localhost:3000,http://localhost:5173"
-            logger.warning(
-                "DEVELOPMENT MODE: Using permissive CORS. Set ALLOWED_ORIGI...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\auth-service\requirements.txt (from phase-3)
```diff
--- PHASE: requirements.txt
+++ REPO: requirements.txt
@@ -2,4 +2,4 @@
-uvicorn[standard]==0.29.0
-pydantic==2.7.1
-pydantic-settings==2.3.0
-sqlalchemy[asyncio]==2.0.30
+uvicorn[standard]==0.30.1
+pydantic==2.7.4
+pydantic-settings==2.3.4
+sqlalchemy==2.0.31
@@ -8,7 +7,0 @@
-redis==5.0.4
-httpx==0.27.0
-twilio==9.1.0
-
-# Auth & Security
-PyJWT[crypto]==2.8.0        # replaces python-jose (CVE fixes)
-cryptography==42.0.8
@@ -16,3 +9,6 @@
-slowapi==0.1.9              # rate limiting
-
-# Observability
+PyJWT[crypto]==2.8.0
+slowapi==0.1.9
+redis==5.0.7
+python-multipart==0.0.9
+email-validator==2.1.1
+pytz==2024.1
@@ -20 +16,4 @@
-prometheus-fastapi-instrumentator==6.1.0
+sentry-sdk[fastapi]
+google-cloud-storage
+python-magic==0.4.27
+cryptography>=42.0.0

```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\auth-service\app\core\security.py (from phase-3)
```diff
--- PHASE: security.py
+++ REPO: security.py
@@ -2 +2,14 @@
-JWT token creation and verification using PyJWT (replaces python-jose).
+backend/auth-service/app/core/security.py
+Phase 5 fix:
+  - RS256 asymmetric JWT (was HS256 symmetric — single shared secret, insecure multi-service)
+  - token_version revocation: incrementing DB field invalidates all old tokens instantly
+  - OTP hashed with HMAC-SHA256 before storing (was stored plaintext)
+  - Fernet PHI encryption loaded from env, not from enc.key file
+"""
+import hashlib
+import hmac
+import os
+import secrets
+import string
+from datetime import datetime, timedelta, timezone
+from typing import Optional
@@ -4,3 +17,5 @@
-python-jose has known CVEs; PyJWT[crypto] is actively maintained and
-provides equivalent RS256 support with a cleaner API.
-"""
+from cryptography.hazmat.primitives import serialization
+from cryptography.hazmat.primitives.asymmetric import rsa
+from cryptography.fernet import Fernet
+import jwt
+from passlib.c...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\mnt\user-data\outputs\backend\healthcare-core\requirements.txt (from phase-3)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\mnt\user-data\outputs\backend\healthcare-core\app\main.py (from phase-3)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\mnt\user-data\outputs\backend\healthcare-core\app\core\security.py (from phase-3)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\ai-service\app\main.py (from phase-4)
```diff
--- PHASE: main.py
+++ REPO: main.py
@@ -1,2 +1,13 @@
-import asyncio
-import json
+# ai-service/app/main.py
+# PHASE 10 FIX + SEC-3 FIX: AI Service implementation with:
+#   1. PHI scrubbing BEFORE any LLM API call (DPDP + safety requirement)
+#   2. Patient consent check BEFORE processing PHI (SEC-3 FIX - working)
+#   3. No real patient data transmitted to third-party APIs without consent
+#   4. Audit log entry for every AI API call involving PHI
+#   5. Triage thresholds marked as requiring clinical validation
+
+from fastapi import FastAPI, HTTPException, Header, Depends
+from fastapi.middleware.cors import CORSMiddleware
+from pydantic import BaseModel, Field
+from sqlalchemy.orm import Session
+import re
@@ -5,62 +16,187 @@
-from typing import Optional
-
-from fastapi import FastAPI
-
-logger = logging.getLogger(__name__)
-
-app = FastAPI(title="Hospyn AI Service")
-
-
-# ---------------------------------------------------------------------------
-# PII/PHI scrubbing (already i...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\ai-service\requirements.txt (from phase-4)
```diff
--- PHASE: requirements.txt
+++ REPO: requirements.txt
@@ -1,13 +1,8 @@
-fastapi>=0.111.0
-uvicorn[standard]>=0.29.0
-pydantic>=2.7.0
-pydantic-settings>=2.2.0
-httpx>=0.27.0
-python-dotenv>=1.0.0
-
-# AI integration
-google-generativeai>=0.7.0
-
-# Testing
-pytest>=8.0.0
-pytest-asyncio>=0.23.0
+fastapi>=0.110.0
+uvicorn[standard]>=0.27.0
+pydantic>=2.6.0
+httpx>=0.26.0
+google-generativeai>=0.4.0
+structlog>=24.1.0
+sentry-sdk[fastapi]>=1.40.0
+google-generativeai>=0.5.0

```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\hr-portal\.env.example (from phase-5/hospyn-phase5)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\hr-portal\src\App.jsx (from phase-5/hospyn-phase5)
```diff
--- PHASE: App.jsx
+++ REPO: App.jsx
@@ -1,7 +1,83 @@
-import { useState, useEffect, useCallback } from 'react';
-import { useNavigate } from 'react-router-dom';
-import { api } from './lib/apiClient';
-import { useAuthStore } from './stores/authStore';
-
-// ─── Skeleton card for loading state ─────────────────────────────────────────
-function SkeletonCard() {
+import React, { useState } from 'react';
+import { 
+  Users, 
+  UserPlus, 
+  ShieldCheck, 
+  Calendar, 
+  Activity, 
+  Settings, 
+  LogOut, 
+  Search,
+  Bell,
+  MoreVertical,
+  CheckCircle2,
+  Clock
+} from 'lucide-react';
+import { motion, AnimatePresence } from 'framer-motion';
+
+const Sidebar = ({ activeTab, setActiveTab }) => (
+  <aside className="sidebar">
+    <div className="sidebar-logo outfit">
+      <div className="p-2 bg-primary rounded-xl">
+        <Activity className="text-white" size={24} />
+      </div>
+      <span>HOSPYN <span className="text-primary">HR</span></span>
+    </div>
+
+    <nav c...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\hr-portal\src\main.jsx (from phase-5/hospyn-phase5)
```diff
--- PHASE: main.jsx
+++ REPO: main.jsx
@@ -1,6 +1,4 @@
-import React from 'react';
-import ReactDOM from 'react-dom/client';
-import { BrowserRouter } from 'react-router-dom';
-import App from './App';
-import { ErrorBoundary } from './components/ErrorBoundary';
-import './index.css';
+import { StrictMode } from 'react'
+import { createRoot } from 'react-dom/client'
+import './index.css'
+import App from './App.jsx'
@@ -8,9 +6,5 @@
-ReactDOM.createRoot(document.getElementById('root')).render(
-  <React.StrictMode>
-    <ErrorBoundary>
-      <BrowserRouter>
-        <App />
-      </BrowserRouter>
-    </ErrorBoundary>
-  </React.StrictMode>
-);
+createRoot(document.getElementById('root')).render(
+  <StrictMode>
+    <App />
+  </StrictMode>,
+)

```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\hr-portal\src\components\ErrorBoundary.jsx (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\hr-portal\src\lib\apiClient.js (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\hr-portal\src\stores\authStore.js (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\shared\src\components\ErrorBoundary.jsx (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\shared\src\lib\apiClient.js (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\.env.example (from phase-5/hospyn-phase5)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\App.jsx (from phase-5/hospyn-phase5)
```diff
--- PHASE: App.jsx
+++ REPO: App.jsx
@@ -1,21 +1,86 @@
-import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
-import { ProtectedRoute } from './components/ProtectedRoute';
-import { ErrorBoundary } from './components/ErrorBoundary';
-
-// Lazy-load pages to keep initial bundle small
-import { lazy, Suspense } from 'react';
-
-const Login          = lazy(() => import('./pages/Login'));
-const Unauthorized   = lazy(() => import('./pages/Unauthorized'));
-const Dashboard      = lazy(() => import('./pages/Dashboard'));
-const Hospitals      = lazy(() => import('./pages/Hospitals'));
-const HospitalDetail = lazy(() => import('./pages/HospitalDetail'));
-const Staff          = lazy(() => import('./pages/Staff'));
-const StaffDetail    = lazy(() => import('./pages/StaffDetail'));
-const Billing        = lazy(() => import('./pages/Billing'));
-const Compliance     = lazy(() => import('./pages/Compliance'));
-const Analytics      = lazy(() => import('./pages/Analytics'));
...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\main.jsx (from phase-5/hospyn-phase5)
```diff
--- PHASE: main.jsx
+++ REPO: main.jsx
@@ -1,5 +1,4 @@
-import React from 'react';
-import ReactDOM from 'react-dom/client';
-import App from './App';
-import { ErrorBoundary } from './components/ErrorBoundary';
-import './index.css';
+import { StrictMode } from 'react'
+import { createRoot } from 'react-dom/client'
+import './index.css'
+import App from './App.jsx'
@@ -7,7 +6,5 @@
-ReactDOM.createRoot(document.getElementById('root')).render(
-  <React.StrictMode>
-    <ErrorBoundary>
-      <App />
-    </ErrorBoundary>
-  </React.StrictMode>
-);
+createRoot(document.getElementById('root')).render(
+  <StrictMode>
+    <App />
+  </StrictMode>,
+)

```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\components\ErrorBoundary.jsx (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\components\ProtectedRoute.jsx (from phase-5/hospyn-phase5)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\lib\apiClient.js (from phase-5/hospyn-phase5)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\pages\Login.jsx (from phase-5/hospyn-phase5)
```diff
--- PHASE: Login.jsx
+++ REPO: Login.jsx
@@ -1,4 +1,4 @@
-import { useState } from 'react';
-import { useNavigate } from 'react-router-dom';
-import { api } from '../lib/apiClient';
-import { useAuthStore } from '../stores/authStore';
+import React, { useState } from 'react';
+import { Shield, Lock, Mail, AlertTriangle, ArrowRight, Loader2, Terminal, Globe } from 'lucide-react';
+import { motion } from 'framer-motion';
+import axios from 'axios';
@@ -6,3 +6 @@
-export default function Login() {
-  const { login } = useAuthStore();
-  const navigate   = useNavigate();
+const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
@@ -10 +8,4 @@
-  const [form, setForm]       = useState({ phone_number: '', password: '' });
+const Login = ({ onLoginSuccess }) => {
+  const [email, setEmail] = useState('');
+  const [password, setPassword] = useState('');
+  const [error, setError] = useState('');
@@ -12 +12,0 @@
-  const [error, setError]     = useState(null);
@@ -14,4 ...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\super-admin-dashboard\src\stores\authStore.js (from phase-5/hospyn-phase5)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\healthcare-core\app\api\router.py (from phase-6/hospyn-phase6)
```diff
--- PHASE: router.py
+++ REPO: router.py
@@ -2,2 +2,3 @@
-Healthcare Core — API Router
-Registers all v1 route modules.
+Healthcare Core API Router
+
+Aggregates all v1 routers into a single root router.
@@ -8,11 +9,24 @@
-from app.api.v1 import (
-    appointments,
-    auth,
-    billing,
-    clinical,
-    consent,        # DPDP compliance — Phase 6
-    hospitals,
-    lab_results,
-    patients,
-    prescriptions,
-    staff,
+from app.api.v1.hospitals import router as hospitals_router
+from app.api.v1.doctors import router as doctors_router
+from app.api.v1.patients import router as patients_router
+from app.api.v1.appointments import router as appointments_router
+from app.api.v1.clinical import router as clinical_router
+from app.api.v1.walkin import router as walkin_router
+from app.api.v1.reception import router as reception_router
+from app.api.v1.nurse import router as nurse_router
+from app.api.v1.doctor_queue import router as doctor_queue_router
+from app.api.v1.ws_endp...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\healthcare-core\app\api\v1\consent.py (from phase-6/hospyn-phase6)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\healthcare-core\app\middleware\consent_check.py (from phase-6/hospyn-phase6)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\healthcare-core\app\services\data_deletion_service.py (from phase-6/hospyn-phase6)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\frontend\src\components\ConsentCollection.jsx (from phase-6/hospyn-phase6)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\conftest.py (from phase-7)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\.github\workflows\deploy.yml (from phase-7)
```diff
--- PHASE: deploy.yml
+++ REPO: deploy.yml
@@ -1 +1 @@
-name: Hospyn CI/CD
+name: CI / CD
@@ -5 +5 @@
-    branches: [main, develop]
+    branches: [main]
@@ -7,8 +7 @@
-    branches: [main, develop]
-
-env:
-  PYTHON_VERSION: "3.11"
-  # Test DB — spun up by the postgres service container below
-  TEST_DATABASE_URL: postgresql+asyncpg://hospyn_test:test_password@localhost:5432/hospyn_test
-  JWT_SECRET_KEY: ci-test-secret-key-minimum-32-chars-long
-  INTERNAL_SERVICE_SECRET: ci-internal-secret
+    branches: [main]
@@ -17,7 +10,21 @@
-  # ─────────────────────────────────────────────────────────────────────────
-  # 1. Auth Service Tests
-  # ─────────────────────────────────────────────────────────────────────────
-  test-auth-service:
-    name: Auth Service — Tests & Coverage
-    runs-on: ubuntu-latest
-
+
+  lint:
+    name: Lint & Security Scan
+    runs-on: ubuntu-22.04
+    steps:
+      - uses: actions/checkout@v4
+      - name: Set up Python
+        uses: actions/setup-pyth...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\test_auth_flow.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\test_migration_integrity.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\test_patient_flow.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\test_security.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\test_sms.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\mnt\user-data\outputs\backend\healthcare-core\tests\conftest.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\mnt\user-data\outputs\backend\notification-service\tests\conftest.py (from phase-7)

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\mnt\user-data\outputs\tests\conftest.py (from phase-7)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\ai-service\app\main.py (from phase-8/hospyn-phase8)
```diff
--- PHASE: main.py
+++ REPO: main.py
@@ -1,10 +1,14 @@
-"""
-backend/ai-service/app/main.py
-AI Service — Gemini-powered clinical summarisation and decision support.
-
-PHI scrubbing is especially important here: Gemini prompts may contain
-patient data. We scrub the entire request body from Sentry events.
-"""
-
-from __future__ import annotations
-
+# ai-service/app/main.py
+# PHASE 10 FIX + SEC-3 FIX: AI Service implementation with:
+#   1. PHI scrubbing BEFORE any LLM API call (DPDP + safety requirement)
+#   2. Patient consent check BEFORE processing PHI (SEC-3 FIX - working)
+#   3. No real patient data transmitted to third-party APIs without consent
+#   4. Audit log entry for every AI API call involving PHI
+#   5. Triage thresholds marked as requiring clinical validation
+
+from fastapi import FastAPI, HTTPException, Header, Depends
+from fastapi.middleware.cors import CORSMiddleware
+from pydantic import BaseModel, Field
+from sqlalchemy.orm import Session
+import re
+import ...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\auth-service\app\main.py (from phase-8/hospyn-phase8)
```diff
--- PHASE: main.py
+++ REPO: main.py
@@ -2,2 +2 @@
-backend/auth-service/app/main.py
-Auth Service — application entry point.
+Auth Service — FastAPI application factory.
@@ -5,6 +4,4 @@
-Startup order matters:
-  1. configure_logging  (first — so every subsequent import can log)
-  2. configure_sentry   (second — catches startup errors too)
-  3. FastAPI app creation + middleware registration
-  4. Router inclusion
-  5. Health router
+Includes:
+- Rate limiting via slowapi (backed by Redis)
+- Structured logging
+- Health endpoint
@@ -14,0 +12 @@
+import logging
@@ -17 +14,0 @@
-import sentry_sdk
@@ -20,2 +17,3 @@
-from sentry_sdk.integrations.fastapi import FastApiIntegration
-from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
+from slowapi import Limiter, _rate_limit_exceeded_handler
+from slowapi.errors import RateLimitExceeded
+from slowapi.util import get_remote_address
@@ -23,4 +21,2 @@
-# ── Shared utilities (add backend/shared to PYTHONPATH or use relative i...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\healthcare-core\app\main.py (from phase-8/hospyn-phase8)
```diff
--- PHASE: main.py
+++ REPO: main.py
@@ -2,2 +2 @@
-backend/healthcare-core/app/main.py
-Healthcare Core Service — application entry point.
+Hospyn Healthcare Core — FastAPI Application Entry Point
@@ -5,3 +4,2 @@
-Handles patient records, appointments, prescriptions, lab results,
-consent management (DPDP), and clinical data APIs.
-PHI scrubbing on all clinical paths is critical.
+This is the main application file that configures CORS, registers all API
+routes, and exposes the health endpoint for Cloud Run.
@@ -10,2 +7,0 @@
-from __future__ import annotations
-
@@ -13,2 +9 @@
-
-import sentry_sdk
+import logging
@@ -17,2 +11,0 @@
-from sentry_sdk.integrations.fastapi import FastApiIntegration
-from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
@@ -20,7 +13 @@
-from shared.health import create_health_router
-from shared.logger import configure_logging, get_logger
-from shared.middleware.correlation import CorrelationMiddleware
-
-from app.api.router import api_router...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\notification-service\app\main.py (from phase-8/hospyn-phase8)
```diff
--- PHASE: main.py
+++ REPO: main.py
@@ -1,3 +1,3 @@
-"""
-backend/notification-service/app/main.py
-Notification Service — OTP delivery, appointment reminders, SMS/email dispatch.
+import logging
+import os
+from contextlib import asynccontextmanager
@@ -5,9 +4,0 @@
-This service handles Twilio credentials — scrub all outbound request details
-from Sentry to avoid leaking phone numbers (PII).
-"""
-
-from __future__ import annotations
-
-import os
-
-import sentry_sdk
@@ -16,5 +6,0 @@
-from sentry_sdk.integrations.fastapi import FastApiIntegration
-
-from shared.health import create_health_router
-from shared.logger import configure_logging, get_logger
-from shared.middleware.correlation import CorrelationMiddleware
@@ -23 +8,0 @@
-from app.core.database import engine
@@ -26,6 +11,5 @@
-SERVICE_NAME = "notification-service"
-VERSION = os.environ.get("APP_VERSION", "2.0.0")
-
-os.environ.setdefault("SERVICE_NAME", SERVICE_NAME)
-configure_logging(SERVICE_NAME)
-logger = get_logger(__na...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\shared\health.py (from phase-8/hospyn-phase8)

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\shared\logger.py (from phase-8/hospyn-phase8)
```diff
--- PHASE: logger.py
+++ REPO: logger.py
@@ -1,24 +0,0 @@
-"""
-backend/shared/logger.py
-Standardised structured logging for all Hospyn microservices.
-
-Production  → JSON lines to stdout (Cloud Run log aggregator picks these up).
-Development → coloured console output via structlog's ConsoleRenderer.
-
-Usage
------
-In each service's main.py *before* any other imports that log:
-
-    from shared.logger import configure_logging, get_logger
-    configure_logging("auth-service")
-    logger = get_logger(__name__)
-
-In request handlers / business logic:
-
-    logger.info("appointment_booked", appointment_id=str(appt.id), patient_id=str(pid))
-    logger.warning("consent_missing", patient_id=str(pid), path=request.url.path)
-    logger.error("db_write_failed", exc_info=True, table="consent_records")
-"""
-
-from __future__ import annotations
-
@@ -26,2 +2 @@
-import os
-
+import sys
@@ -28,0 +4 @@
+from app.config.settings import settings
@@ -31 +7 @@
-def configure_logging(service_...
```

DIFF FOUND: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\backend\shared\middleware\correlation.py (from phase-8/hospyn-phase8)
```diff
--- PHASE: correlation.py
+++ REPO: correlation.py
@@ -1,12 +0,0 @@
-"""
-backend/shared/middleware/correlation.py
-Assigns a unique X-Request-ID to every inbound request and echoes it in
-the response header.  Binds request metadata to the structlog context so
-every log line emitted during the request automatically carries the ID.
-
-Timing is measured with time.perf_counter() for sub-millisecond accuracy.
-"""
-
-from __future__ import annotations
-
-import time
@@ -14 +2,2 @@
-
+from starlette.middleware.base import BaseHTTPMiddleware
+from starlette.requests import Request
@@ -16,8 +4,0 @@
-from fastapi import Request
-from starlette.middleware.base import BaseHTTPMiddleware
-from starlette.responses import Response
-
-logger = structlog.get_logger(__name__)
-
-# Paths excluded from request logging (noisy, low-value)
-_SILENT_PATHS = frozenset({"/health", "/metrics", "/favicon.ico", "/openapi.json"})
@@ -26 +7 @@
-class CorrelationMiddleware(BaseHTTPMiddleware):
+class Correlation...
```

MISSING: c:\Users\DELL\OneDrive\Desktop\ahp-end-game-new\tests\production_readiness_verify.py (from phase-8/hospyn-phase8)