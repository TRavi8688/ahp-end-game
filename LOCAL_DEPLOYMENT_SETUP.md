# 🚀 Local Deployment Setup Guide

## Current Issues with Patient App

1. **Database Connection**: .env configured for Docker services (won't work locally)
2. **Missing OTP System**: Requires Redis (not running locally)
3. **Complex Registration Flow**: 
   - New users must register → Send OTP → Verify OTP → Setup Profile
   - Current flow breaks because Redis is unavailable
4. **Login Issues**: App expects AHP-ID but new users haven't registered yet

## Solution: Quick Local Setup

### Option 1: Using SQLite (Fastest - Recommended)

SQLite needs no setup and works perfectly for local testing.

**Step 1: Create .env.local**
```bash
# Copy and modify for local development
DATABASE_URL=sqlite+aiosqlite:///./ahp_dev.db
REDIS_URL=redis://localhost:6379/0  # Skip Redis for now (optional)
ENVIRONMENT=development
DEBUG=true
# Copy other values from .env (API keys, JWT keys, etc.)
```

**Step 2: Install Python Dependencies**
```bash
pip install poetry
poetry install
```

**Step 3: Initialize Database**
```bash
python init_db.py
```

**Step 4: Populate Test Data**
```bash
python create_doctor.py  # Creates test doctor account
python seed_credentials.py  # Creates test patient account
```

**Step 5: Start Backend**
```bash
python start_api.py
# Backend runs on http://localhost:8000
```

**Step 6: Start Patient App**
```bash
cd patient-app
npm install
npm run web
# App runs on http://localhost:19006
```

---

### Option 2: Using PostgreSQL Locally

**Step 1: Install PostgreSQL**
- Download from: https://www.postgresql.org/download/
- During install, remember the password you set

**Step 2: Create Database**
```bash
# Use pgAdmin or command line
createdb ahp_dev
```

**Step 3: Update .env**
```
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/ahp_dev
```

**Step 4: Continue with Step 4 above (Initialize Database)**

---

## Testing the Setup

### Login Flow (for existing users)
```
AHP-ID: AHP-TEST1234  (from seed data)
Password: TestPass123!
```

### New User Registration Flow
1. Register with email/phone
2. System will send OTP to console (check server logs)
3. Verify with OTP from logs
4. Complete profile setup
5. Now you can login with your AHP-ID

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redis Connection Failed | Optional for dev - OTP will log to console |
| Database File Not Created | Run: `python init_db.py` |
| Port 8000 Already in Use | Change: `uvicorn run app.main:app --port 9000` |
| Patient App Can't Connect | Check CORS: `ALLOWED_ORIGINS=["http://localhost:19006"]` |
| OTP Not Received | Check server console logs (OTP printed there in dev) |

---

## Architecture Overview

```
┌─────────────────────┐
│   Patient App       │
│  (React/Expo)       │
│  :19006             │
└──────────┬──────────┘
           │ HTTP/WS
           ↓
┌─────────────────────┐
│   FastAPI Backend   │
│   :8000             │
└──────────┬──────────┘
           │ SQL
           ↓
    ┌─────────────┐
    │  SQLite/PG  │
    │ (ahp_dev.db)│
    └─────────────┘
```

---

## Quick Start Command

```bash
# From project root
echo "Installing npm deps..."
cd patient-app && npm install & cd ../doctor-app && npm install & cd ..

echo "Installing Python deps..."
poetry install

echo "Initializing database..."
python init_db.py

echo "Starting services..."
# In terminal 1:
python start_api.py

# In terminal 2:
cd patient-app && npm run web

# In terminal 3:
cd doctor-app && npm run start
```
