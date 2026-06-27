# Hospain — Production Deployment Checklist
**Full Bug Fix Round (Phase 1 + Phase 2)**  
**Date:** June 26, 2026

---

## PRE-DEPLOY: Environment Variables (Do This First)

Set all of these in **GCP Secret Manager** and mount at Cloud Run deploy time.

```bash
# === AUTH SERVICE ===

# JWT RSA Keys — generate ONCE, never regenerate (all sessions invalidated on change)
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem
# Then base64-encode and store:
JWT_PRIVATE_KEY_PEM=$(base64 -w0 private_key.pem)
JWT_PUBLIC_KEY_PEM=$(base64 -w0 public_key.pem)

# OTP Delivery
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx

# Email Fallback (use Resend.com — free 3000/month)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxxxxxxxxxxxxxx
SMTP_FROM_EMAIL=otp@hospain.in

# Migration endpoint security
MIGRATION_SECRET=<random 32+ char string>

# Google OAuth
GOOGLE_CLIENT_ID=<from GCP Console — move out of source code>

# === HEALTHCARE CORE ===

# Must match auth-service public key
JWT_PUBLIC_KEY_PEM=<same as above>
AUTH_JWKS_URL=https://auth.hospain.in/api/v1/auth/.well-known/jwks.json
```

---

## DATABASE MIGRATION

Run in this order on the production PostgreSQL database:

```bash
# Step 1: Apply all Alembic migrations
cd backend/auth-service
alembic upgrade head

# Step 2: Verify new columns exist
psql $DATABASE_URL -c "\d users" | grep -E "employee_id|is_temporary"

# Expected output:
#  employee_id          | character varying(10)  |
#  is_temporary_password| boolean                | not null default false
```

**Alternative (if Alembic not set up):**
```bash
curl -X GET https://your-auth-service/api/v1/auth/run-auth-migrations \
  -H "X-Migration-Secret: YOUR_MIGRATION_SECRET"
```

---

## DEPLOY ORDER

Deploy in this sequence (auth-service first since others depend on its JWKS):

```
1. auth-service      → wait for healthy
2. healthcare-core   → wait for healthy  
3. matrix (frontend) → deploy last
4. doctor-app        → apply patches, rebuild
5. patient-app       → apply patches, rebuild
6. partner-app       → apply patches, rebuild
7. staff-portal      → apply patches, rebuild
8. hospyn-v2-web     → apply patches, rebuild
```

---

## FILES TO DEPLOY (Changed in This Session)

### auth-service (replace these files):
```
app/models/user.py                    ← employee_id + is_temporary_password columns
app/api/v1/auth.py                    ← employee_id login, change-password endpoint, employee create, all db.commit() fixes
app/middleware/rbac.py                ← PyJWT fix, hospital_id/token_version claim keys, exact role check
app/core/security.py                  ← JWKS bug fix (pub_key.public_numbers() not .public_key().public_numbers())
app/services/auth_service.py         ← generate_employee_id(), generate_temp_password(), OTP log fix
app/config/settings.py               ← JWT_ALGORITHM HS256 → RS256
alembic/versions/003_employee_id_temp_password.py  ← NEW migration
```

### healthcare-core (replace these files):
```
app/middleware/rbac.py    ← hospital_id/token_version claim key fix, is_superadmin fix, employee_id + must_change_password in CurrentUser
app/api/v1/employees.py  ← New 6-char H+R employee ID format, db.commit() fixes
```

### matrix frontend (replace src/ folder):
```
src/pages/Login.jsx                          ← Employee ID login, exact role check
src/pages/ChangePassword.jsx                 ← NEW: forced + voluntary password change
src/pages/matrix/EmployeeAccounts.jsx        ← NEW: HR tool to create employee accounts
src/components/ProtectedRoute.jsx            ← must_change_password intercept
src/stores/authStore.js                      ← stores must_change_password in session
src/services/apiClient.js                    ← BUG-18 fix: consistent return shape
src/App.jsx                                  ← new routes: /change-password, matrix/employee-accounts
```

---

## SMOKE TESTS (Run After Deploy)

```bash
# 1. Create an employee account
curl -X POST https://auth.hospain.in/api/v1/auth/employees/create \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Test Employee", "email": "test@hospain.in", "role": "l1"}'
# Expected: {"employee_id": "H3RK9N", "temp_password": "TempXx@123", ...}

# 2. Login with employee_id + temp_password
curl -X POST https://auth.hospain.in/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "H3RK9N", "password": "TempXx@123"}'
# Expected: {"access_token": "...", "must_change_password": true, ...}

# 3. Change password
curl -X POST https://auth.hospain.in/api/v1/auth/change-password \
  -H "Authorization: Bearer $TOKEN_FROM_ABOVE" \
  -H "Content-Type: application/json" \
  -d '{"new_password": "MyNewPass1!"}'
# Expected: {"message": "Password updated successfully.", "must_change_password": false, ...}

# 4. Login again with new password
curl -X POST https://auth.hospain.in/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "H3RK9N", "password": "MyNewPass1!"}'
# Expected: {"must_change_password": false, ...}

# 5. Verify JWKS endpoint works
curl https://auth.hospain.in/api/v1/auth/.well-known/jwks.json
# Expected: {"keys": [{"kty": "RSA", "alg": "RS256", ...}]}

# 6. Verify migration endpoint is secured
curl https://auth.hospain.in/api/v1/auth/run-auth-migrations
# Expected: 403 Forbidden

# 7. Verify migration endpoint works with secret
curl -H "X-Migration-Secret: $MIGRATION_SECRET" \
  https://auth.hospain.in/api/v1/auth/run-auth-migrations
# Expected: {"status": "done", ...}
```

---

## COMPLETE BUG TRACKER

| ID | Product | Severity | Fixed In | Description |
|----|---------|----------|----------|-------------|
| BUG-1 | auth-service | HIGH | ✅ settings.py | JWT_ALGORITHM HS256→RS256 |
| BUG-2 | auth-service | 🔴 CRITICAL | ✅ rbac.py | Wrong JWT library (jose→PyJWT) |
| BUG-3 | auth-service + hc-core | 🟠 HIGH | ✅ rbac.py (both) | Claim key hid→hospital_id |
| BUG-4 | auth-service + hc-core | 🟠 HIGH | ✅ rbac.py (both) | Claim key ver→token_version |
| BUG-5 | auth-service | 🟠 HIGH | ⚠️ ENV VARS | Twilio/SMTP empty — OTP broken |
| BUG-6 | auth-service | 🟠 HIGH | ⚠️ ENV VARS | RSA keys not set — ephemeral sessions |
| BUG-7 | auth-service | 🟠 HIGH | ✅ security.py | JWKS pub_key.public_numbers() crash |
| BUG-8 | auth-service | 🟡 MEDIUM | ✅ auth.py | Migration endpoint now requires secret |
| BUG-9 | auth-service | 🟡 MEDIUM | ✅ auth.py | All db.flush() now have db.commit() (8 fixes) |
| BUG-10 | auth-service | 🟡 MEDIUM | ✅ auth_service.py | OTP plaintext removed from logs |
| BUG-11 | doctor-app | 🔴 CRITICAL | 📄 PATCH | OTP send field name: identifier→phone/email |
| BUG-12 | doctor-app | 🔴 CRITICAL | 📄 PATCH | OTP login sends wrong field |
| BUG-13 | doctor-app | 🔴 CRITICAL | 📄 PATCH | Dual-storage auth gate breaks new tabs |
| BUG-14 | doctor-app | 🟠 HIGH | 📄 PATCH | useAuthStore dead code |
| BUG-15 | doctor-app | 🟡 MEDIUM | ✅ (backend fixed) | Legacy router registration |
| BUG-16 | hospyn-v2-web | 🟠 HIGH | 📄 PATCH | branches never passed to saveSession |
| BUG-17 | hospyn-v2-web | 🟠 HIGH | 📄 PATCH | Owner token in localStorage→sessionStorage |
| BUG-18 | matrix | 🟠 HIGH | ✅ services/apiClient.js | Dual API client return shapes unified |
| BUG-19 | matrix | 🟡 MEDIUM | ✅ Login.jsx | Substring role match→exact match |
| BUG-20 | matrix | 🟢 LOW | ✅ Login.jsx | Duplicate 'hospain_employee' in ALLOWED_ROLES |
| BUG-21 | partner-app | 🟠 HIGH | 📄 PATCH | No /healthcare prefix on API calls |
| BUG-22 | partner-app | 🟡 MEDIUM | 📄 PATCH | No role check after partner login |
| BUG-23 | partner-app | 🟡 MEDIUM | 📄 PATCH | Hardcoded production URL fallback |
| BUG-24 | patient-app | 🔴 CRITICAL | 📄 PATCH | Hospyn ID startsWith('Hospyn-') vs 'HOSPYN-' |
| BUG-25 | patient-app | 🔴 CRITICAL | 📄 PATCH | Wrong /healthcare path for patient login |
| BUG-26 | patient-app | 🟠 HIGH | 📄 PATCH | Social login stub — wiring instructions provided |
| BUG-27 | patient-app | 🟡 MEDIUM | 📄 PATCH | api.js interceptor empty — no token attached |
| BUG-28 | patient-app | 🟡 MEDIUM | 📄 PATCH | isAuthenticated set before token verified |
| BUG-29 | staff-portal | 🟡 MEDIUM | 📄 PATCH | PHI alerts in localStorage→sessionStorage |
| BUG-30 | staff-portal | 🟢 LOW | 📄 PATCH | Security footer shows HS256 (incorrect) |
| BUG-NEW | ALL products | ✅ Feature | ✅ auth + matrix | Employee ID login system (6-char H+R) |
| BUG-NEW | matrix | ✅ Feature | ✅ ChangePassword.jsx | Forced password change on first login |
| BUG-NEW | matrix | ✅ Feature | ✅ EmployeeAccounts.jsx | HR tool: create employee + generate ID |

**Legend:**  
✅ = Fixed in code delivered in this session  
📄 PATCH = Patch instructions in patches/ folder (source not in provided zip)  
⚠️ ENV VARS = Requires provisioning secrets in GCP — cannot be fixed in code alone
