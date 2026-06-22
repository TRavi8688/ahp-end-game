# Hospain Matrix 3.0 — Employee Login & Credential Management
## The Complete Answer to "How do employees log in?"

---

## THE FLOW (step by step)

```
Super Admin creates employee account
         ↓
System stores: email + hashed password + role + team
         ↓
Admin shares email + temp password with employee
         ↓
Employee opens /login → enters email + password
         ↓
Backend verifies → returns JWT token
         ↓
Frontend stores token in sessionStorage
         ↓
Role is checked → employee sees only their permitted modules
```

---

## WHO CAN LOG IN

Any `hospyn_employee` row in the DB with:
- `email` set
- `hashed_password` set
- `is_active = true`
- `role` is one of the allowed roles

---

## ROLES AND WHAT THEY SEE

| Role | Level | Can See |
|------|-------|---------|
| `super_admin` | 100 | Everything — all 21 modules |
| `admin` | 90 | Everything except delete super admins |
| `manager` | 70 | All modules including financials, broadcasts |
| `team_lead` | 50 | Tickets, workload, team performance, SLA |
| `l2` | 30 | Escalated tickets, system logs |
| `l1` | 20 | Assigned tickets only — reply, resolve, escalate |

---

## HOW TO CREATE EMPLOYEE ACCOUNTS

### Option 1: Via the UI (Employee Command Center)
1. Log in as Super Admin
2. Go to **Workforce → Employee Command Center**
3. Click **"+ Create Employee Account"**
4. Fill: Name, Email, Role, Team, Temporary Password
5. Click Create → share credentials with employee

### Option 2: Via Backend API
```bash
curl -X POST http://localhost:8000/api/v1/matrix/employees/create \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Priya Krishnan",
    "email": "priya@hospain.in",
    "role": "l1",
    "team": "support",
    "password": "TempPass123!"
  }'
```

### Option 3: Directly in PostgreSQL (for initial setup)
```sql
INSERT INTO hospyn_employees 
  (id, employee_id, full_name, email, hashed_password, role, team, level, is_active, shift_status, daily_ticket_limit, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'HPN-ADM-001',
  'Super Admin',
  'admin@hospain.in',
  -- Generate hash: python3 -c "from passlib.context import CryptContext; print(CryptContext(['bcrypt']).hash('YourPassword123!'))"
  '$2b$12$YOURHASHHERE',
  'super_admin',
  'admin',
  'super_admin',
  true,
  'online',
  100,
  NOW(), NOW()
);
```

---

## FIRST TIME SETUP (no employees in DB yet)

Run this ONE TIME to create your first Super Admin:

```bash
cd backend/backend/healthcare-core
python3 -c "
from passlib.context import CryptContext
pwd = CryptContext(['bcrypt']).hash('Admin@Hospain2024!')
print(f'Hash: {pwd}')
"
# Copy that hash, then run:
psql -d hospain -c \"
  INSERT INTO hospyn_employees 
    (id, employee_id, full_name, email, hashed_password, role, team, level, is_active, shift_status, daily_ticket_limit, created_at, updated_at)
  VALUES (
    gen_random_uuid(), 'HPN-SADM-001', 'Super Admin', 'admin@hospain.in',
    'PASTE_HASH_HERE', 'super_admin', 'admin', 'super_admin', true, 'online', 100, NOW(), NOW()
  );
\"
```

Then log in at `/login` with:
- Email: `admin@hospain.in`
- Password: `Admin@Hospain2024!`

---

## PASSWORD MANAGEMENT

### Reset an employee's password (via UI):
Employee Command Center → select employee → "Reset Password" button

### Reset via API:
```bash
curl -X POST http://localhost:8000/api/v1/matrix/employees/HPN-SUP-L1-001/reset-password \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -d '{"new_password": "NewTemp@456!"}'
```

---

## SECURITY NOTES

- Passwords are bcrypt-hashed — never stored in plain text
- JWT tokens expire (configurable in backend settings)
- Sessions stored in `sessionStorage` — clears when browser tab closes
- Every action (create, suspend, role change, password reset) is logged to `audit_logs`
- Suspended employees are immediately blocked from all API calls

