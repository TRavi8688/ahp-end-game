# ⚡ QUICK START - LOCAL DEPLOYMENT (2 Minutes)

## Option 1: Using Batch File (Easiest)
```bash
# Double-click this file from File Explorer:
START_LOCAL_DEPLOYMENT.bat
```
This will:
1. Install npm dependencies
2. Start Mock Backend (port 8000)
3. Start Doctor App (port 3000)
4. Start Patient App (port 19006)

Then:
- Navigate to: http://localhost:19006
- Login with: **AHP-123456-XYZ** / **Test@123**

---

## Option 2: Using PowerShell
```powershell
# Open PowerShell and run:
.\START_LOCAL_DEPLOYMENT.ps1
```

---

## Option 3: Manual Start (Full Control)

### Terminal 1: Backend
```bash
node mock_backend.js
```
✓ Backend ready on http://localhost:8000

### Terminal 2: Patient App
```bash
cd patient-app
npm install
npm run web
```
✓ App ready on http://localhost:19006

### Terminal 3: Doctor App
```bash
cd doctor-app
npm install
npm run start
```
✓ App ready on http://localhost:3000

---

## 🔑 Test Credentials

| Field | Value |
|-------|-------|
| **AHP-ID** | AHP-123456-XYZ |
| **Password** | Test@123 |
| **New User OTP** | 000000 |

---

## ✅ What Works

- ✅ Patient app login
- ✅ Doctor app login (coming soon)
- ✅ New user registration
- ✅ OTP verification
- ✅ Profile setup
- ✅ View health records

---

## ❌ Known Limitations (Mock Backend)

- No actual database persistence (resets on restart)
- OTP always accepts "000000"
- No real medical data storage
- For production, see setup instructions below

---

## 🏗️ Switch to Real Backend (With Database)

When you're ready, see: **LOCAL_DEPLOYMENT_SETUP.md**

This covers:
- Installing Python & dependencies
- Setting up SQLite or PostgreSQL
- Database initialization
- Real backend startup

---

## 🆘 Stuck?

1. **"Port already in use"**: Close other Node processes
   ```powershell
   lsof -i :8000
   # or kill PORT processes in Task Manager
   ```

2. **"npm install fails"**: Use legacy peer deps
   ```bash
   npm install --legacy-peer-deps
   ```

3. **"Backend not responding"**: Make sure all 3 terminals running
   ```
   Terminal 1: node mock_backend.js (should say "running on port 8000")
   Terminal 2: npm run web (should say "Listening on...")
   Terminal 3: npm run start
   ```

For detailed troubleshooting: **TROUBLESHOOTING_LOGIN_REGISTRATION.md**

---

## 🎯 Next Steps

1. **Test the apps** with mock backend (this file)
2. **Review requirements** in LOCAL_DEPLOYMENT_SETUP.md
3. **Install Python** (if needed)
4. **Switch to real backend** when ready

---

**Created**: May 7, 2026
**For**: AHP 2.0 Local Development
