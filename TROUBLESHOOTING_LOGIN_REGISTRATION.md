# 🔧 TROUBLESHOOTING: Patient App Login & Registration Issues

## Quick Diagnosis Checklist

### ✓ Issue 1: Database Connection Error
**Symptom**: Backend won't start or crashes on startup
**Solution**:
- For **local dev**: Use SQLite (no setup needed)
- For **Docker**: Use `docker-compose up -d`
- Check `.env` file exists with `DATABASE_URL`

### ✓ Issue 2: New Users Can't Register
**Symptom**: Registration endpoint returns error
**Problems Found**:
1. **Redis unavailable**: OTP system needs Redis
   ```
   Solution: Use mock backend or install Redis
   ```
2. **Complex registration flow**:
   ```
   Register → Send OTP → Verify OTP → Setup Profile
   ```

### ✓ Issue 3: Login Not Working
**Symptom**: "Invalid Mulajna ID or password"
**Problems Found**:
1. **No test user data**: Database is empty
   ```
   Solution: Run seed_credentials.py
   ```
2. **AHP-ID mismatch**: Patient table doesn't have ahp_id
   ```
   Solution: Run init_db.py to initialize schema
   ```

### ✓ Issue 4: Backend Connection Failed
**Symptom**: Patient app shows network error
**Problems Found**:
1. **Backend not running on port 8000**
   ```
   Solution: Start mock_backend.js or uvicorn
   ```
2. **CORS blocked**
   ```
   Solution: CORS headers already set in mock_backend.js
   ```

---

## 🚀 IMMEDIATE FIX: Using Mock Backend

The **fastest solution** is to use the mock backend (just Node.js, no Python needed).

### Step 1: Start Mock Backend
```bash
node mock_backend.js
```

### Step 2: Start Patient App
```bash
cd patient-app
npm run web
```

### Step 3: Login with Test Account
```
AHP-ID: AHP-123456-XYZ
Password: Test@123
```

---

## 📋 FULL SETUP: With Real Backend

### Prerequisite: Install Python
1. Download Python 3.11+ from https://www.python.org/
2. During installation, **IMPORTANT**: Check "Add Python to PATH"
3. Verify in PowerShell:
   ```powershell
   python --version
   ```

### Step 1: Install Poetry
```powershell
pip install poetry
```

### Step 2: Install Dependencies
```powershell
poetry install
```

### Step 3: Initialize Database
```powershell
python init_db.py
```

### Step 4: Seed Test Data
```powershell
python create_doctor.py
python seed_credentials.py
```

### Step 5: Start Backend
```powershell
python start_api.py
```

### Step 6: Start Apps
```powershell
# Terminal 2
cd patient-app
npm run web

# Terminal 3
cd doctor-app
npm run start
```

---

## 🧪 Testing Checklist

### Test 1: Backend Health
```bash
curl http://localhost:8000/health
```
Expected: `{"status": "ready", "mock": true}`

### Test 2: Existing User Login
```bash
# Patient App
AHP-ID: AHP-123456-XYZ
Password: Test@123
```

### Test 3: New User Registration
```
1. Click "Create Account"
2. Enter: Full name, phone, password
3. OTP (mock backend): 000000
4. Complete profile setup
5. Now can login with new AHP-ID
```

---

## 🔍 Debug Tips

### Check API Logs
```
Mock Backend: Watch console output for [Mock] logs
Real Backend: Check console for [STARTUP] and [LOGIN] logs
```

### Check Patient App Logs
```
Patient App Web: Open browser DevTools
  F12 → Console tab → Look for network errors
```

### Verify Database Connection
```powershell
# If using SQLite
ls ahp_dev.db

# If using PostgreSQL
psql -U postgres -d ahp_dev -c "SELECT 1"
```

### Common Port Conflicts
```
Port 8000 (Backend):
  lsof -i :8000
  Kill: taskkill /PID <pid> /F

Port 19006 (Patient App):
  lsof -i :19006
  Kill: taskkill /PID <pid> /F
```

---

## 🆘 Still Having Issues?

### Backend Issues
- **"DATABASE_URL not found"**: Add to .env
- **"Redis connection failed"**: OK for development (use mock)
- **"Port 8000 already in use"**: Change PORT env var or kill process

### Patient App Issues  
- **"Cannot connect to backend"**: Check CORS, verify port 8000 running
- **"OTP not received"**: Check server logs (OTP printed there)
- **"AHP-ID not recognized"**: Run seed_credentials.py

### Database Issues
- **"Table not found"**: Run init_db.py
- **"User not found"**: Run seed_credentials.py
- **"Foreign key error"**: Likely schema mismatch, run migration

---

## 📊 Architecture Verification

```
Patient App          Doctor App          Backend
(Port 19006)        (Port 3000)         (Port 8000)
    |                    |                   |
    +----CORS Headers----+----CORS Headers---+
    |                    |                   |
    +--------HTTP API Calls-----------------+
    |          GET/POST: /api/v1/*           |
    |                    |                   |
    +-----Optional: WebSocket-----------+    |
                                        |    |
                                    Database
                                   (Local/
                                   Remote)
```

---

## ✅ Success Indicators

- ✓ Backend starts without errors
- ✓ Patient app loads in browser
- ✓ "AHP-123456-XYZ" login works
- ✓ New user registration flows work
- ✓ Can see health records after login

---

## 🚨 Emergency Reset

If everything is broken:

```powershell
# Remove node_modules and lock files
rm -r patient-app/node_modules
rm -r doctor-app/node_modules
rm patient-app/package-lock.json
rm doctor-app/package-lock.json

# Remove database
rm ahp_dev.db

# Reinstall from scratch
cd patient-app && npm install
cd ../doctor-app && npm install
cd ..

# Reinitialize
python init_db.py
python seed_credentials.py

# Start fresh
node mock_backend.js
# (in new terminal)
cd patient-app && npm run web
```

---

## 📞 Support Info

If you can't resolve the issue, provide:
1. Error message (exact text)
2. Which step failed (backend/app/database/etc)
3. What you've already tried
4. Output of: `node --version`, `npm --version`, `python --version` (if applicable)
