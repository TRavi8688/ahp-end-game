"""
HOSPYN FOG TEST — Full System Smoke & Latency Diagnostic
=========================================================
Tests every major endpoint, measures response times, validates
backend↔DB↔frontend connectivity, and finds broken links.
"""
import requests
import time
import json
import sys

BASE = "http://127.0.0.1:8000/api/v1"
RESULTS = []
ERRORS = []
WARNINGS = []

# ── Test accounts seeded in DB ──
ACCOUNTS = {
    "owner_apollo": {"username": "owner@apollo.com", "password": "admin123"},
    "owner_narayana": {"username": "owner@narayana.com", "password": "admin123"},
    "owner_cloudnine": {"username": "owner@cloudnine.com", "password": "admin123"},
    "owner_carefirst": {"username": "owner@carefirst.com", "password": "admin123"},
    "owner_medall": {"username": "owner@medall.com", "password": "admin123"},
}

def elapsed_color(ms):
    if ms < 200: return "FAST"
    if ms < 500: return "OK"
    if ms < 1500: return "SLOW"
    return "CRITICAL_LAG"

def test_endpoint(method, path, token=None, data=None, label=None, expect_status=None):
    url = f"{BASE}{path}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    start = time.perf_counter()
    try:
        if method == "GET":
            r = requests.get(url, headers=headers, timeout=15)
        elif method == "POST":
            if data:
                r = requests.post(url, json=data, headers=headers, timeout=15)
            else:
                r = requests.post(url, data={}, headers=headers, timeout=15)
        elif method == "PUT":
            r = requests.put(url, json=data or {}, headers=headers, timeout=15)
        elif method == "PATCH":
            r = requests.patch(url, json=data or {}, headers=headers, timeout=15)
        else:
            r = requests.request(method, url, headers=headers, timeout=15)
        
        elapsed_ms = (time.perf_counter() - start) * 1000
        speed = elapsed_color(elapsed_ms)
        
        status_ok = True
        if expect_status:
            status_ok = r.status_code == expect_status
        else:
            status_ok = r.status_code < 500
        
        result = {
            "label": label or f"{method} {path}",
            "status": r.status_code,
            "latency_ms": round(elapsed_ms, 1),
            "speed": speed,
            "ok": status_ok,
            "size_bytes": len(r.content),
        }
        
        if not status_ok:
            try:
                detail = r.json().get("detail", r.text[:200])
            except:
                detail = r.text[:200]
            result["error"] = detail
            ERRORS.append(result)
        
        if speed in ("SLOW", "CRITICAL_LAG"):
            WARNINGS.append(result)
            
        RESULTS.append(result)
        return r, elapsed_ms
    except requests.exceptions.ConnectionError:
        result = {
            "label": label or f"{method} {path}",
            "status": "CONNECTION_REFUSED",
            "latency_ms": -1,
            "speed": "DEAD",
            "ok": False,
            "error": "Backend not reachable"
        }
        ERRORS.append(result)
        RESULTS.append(result)
        return None, -1
    except requests.exceptions.Timeout:
        elapsed_ms = (time.perf_counter() - start) * 1000
        result = {
            "label": label or f"{method} {path}",
            "status": "TIMEOUT",
            "latency_ms": round(elapsed_ms, 1),
            "speed": "DEAD",
            "ok": False,
            "error": "Request timed out after 15s"
        }
        ERRORS.append(result)
        RESULTS.append(result)
        return None, elapsed_ms

def login(username, password):
    r, ms = test_endpoint("POST", "/auth/login", data=None, label=f"LOGIN {username}")
    # Login uses form data not JSON
    start = time.perf_counter()
    try:
        r = requests.post(f"{BASE}/auth/login", data={"username": username, "password": password}, timeout=15)
        ms = (time.perf_counter() - start) * 1000
        if r.status_code == 200:
            token = r.json().get("access_token")
            return token, ms
        else:
            return None, ms
    except:
        return None, -1

# Remove the duplicate login test entry
RESULTS.clear()
ERRORS.clear()

print("=" * 70)
print("  HOSPYN FOG TEST — Full Stack Diagnostic")
print("=" * 70)
print()

# ═══════════════════════════════════════════════════════════════
# PHASE 1: Backend Reachability
# ═══════════════════════════════════════════════════════════════
print("[PHASE 1] Backend Reachability...")
test_endpoint("GET", "/../openapi.json", label="OpenAPI Schema (root health)")
test_endpoint("GET", "/auth/diag", label="Auth Diagnostics")
print(f"  Results: {len(RESULTS)} tests, {len(ERRORS)} errors")

# ═══════════════════════════════════════════════════════════════
# PHASE 2: Authentication — All 5 Hospital Logins
# ═══════════════════════════════════════════════════════════════
print("\n[PHASE 2] Authentication — Testing all 5 hospital owner logins...")
tokens = {}
for name, creds in ACCOUNTS.items():
    token, ms = login(creds["username"], creds["password"])
    speed = elapsed_color(ms) if ms > 0 else "DEAD"
    result = {
        "label": f"LOGIN {creds['username']}",
        "status": 200 if token else "FAIL",
        "latency_ms": round(ms, 1),
        "speed": speed,
        "ok": token is not None,
    }
    if not token:
        result["error"] = "Login failed — no token returned"
        ERRORS.append(result)
    if speed in ("SLOW", "CRITICAL_LAG"):
        WARNINGS.append(result)
    RESULTS.append(result)
    tokens[name] = token
    print(f"  {'OK' if token else 'FAIL'} {creds['username']} — {round(ms,1)}ms [{speed}]")

# ═══════════════════════════════════════════════════════════════
# PHASE 3: Owner Dashboard (the endpoint that was crashing)
# ═══════════════════════════════════════════════════════════════
print("\n[PHASE 3] Owner Dashboard — Testing all 5 hospitals...")
dashboard_data = {}
for name, token in tokens.items():
    if not token:
        print(f"  SKIP {name} (no token)")
        continue
    r, ms = test_endpoint("GET", "/owner/dashboard", token=token, label=f"DASHBOARD {name}")
    if r and r.status_code == 200:
        data = r.json()
        dashboard_data[name] = data
        print(f"  OK {data.get('hospital_name','?')} [{data.get('scale','?')}-Level] — {round(ms,1)}ms [{elapsed_color(ms)}]")
        print(f"     Revenue: Rs{data.get('telemetry',{}).get('revenue',0):,.2f} | Visits: {data.get('telemetry',{}).get('visits',0)} | Beds: {data.get('telemetry',{}).get('beds_occupied',0)}/{data.get('telemetry',{}).get('beds_total',0)}")
    else:
        status = r.status_code if r else "NO_RESPONSE"
        error = ""
        try: error = r.json().get("detail","")
        except: pass
        print(f"  FAIL {name} — HTTP {status} — {error}")

# ═══════════════════════════════════════════════════════════════
# PHASE 4: Core API Endpoints (using Apollo token)
# ═══════════════════════════════════════════════════════════════
print("\n[PHASE 4] Core API Smoke Test (Apollo owner)...")
apollo_token = tokens.get("owner_apollo")

if apollo_token:
    # Admin endpoints
    test_endpoint("GET", "/audit-logs", token=apollo_token, label="Admin: Audit Logs")
    test_endpoint("GET", "/stats", token=apollo_token, label="Admin: Stats")
    test_endpoint("GET", "/hospitals", token=apollo_token, label="Admin: Hospitals List")
    
    # Staff
    test_endpoint("GET", "/staff/members", token=apollo_token, label="Staff: Members List")
    
    # Billing
    test_endpoint("GET", "/billing/pending-visits", token=apollo_token, label="Billing: Pending Visits")
    test_endpoint("GET", "/billing/my-invoices", token=apollo_token, label="Billing: My Invoices")
    
    # Pharmacy
    test_endpoint("GET", "/pharmacy/stats", token=apollo_token, label="Pharmacy: Stats")
    test_endpoint("GET", "/pharmacy/inventory", token=apollo_token, label="Pharmacy: Inventory")
    test_endpoint("GET", "/pharmacy/transactions", token=apollo_token, label="Pharmacy: Transactions")
    
    # Governance
    test_endpoint("GET", "/governance/ai-safety-dashboard", token=apollo_token, label="Governance: AI Safety")
    test_endpoint("GET", "/governance/compliance/audit-integrity", token=apollo_token, label="Governance: Audit Integrity")
    test_endpoint("GET", "/governance/infrastructure/hygiene", token=apollo_token, label="Governance: Infra Hygiene")
    
    # Clinical
    test_endpoint("GET", "/clinical/prescriptions", token=apollo_token, label="Clinical: Prescriptions")
    
    # Doctor
    test_endpoint("GET", "/doctor/profile", token=apollo_token, label="Doctor: Profile")
    test_endpoint("GET", "/doctor/stats", token=apollo_token, label="Doctor: Stats")
    test_endpoint("GET", "/doctor/queue", token=apollo_token, label="Doctor: Queue")
    
    # Patient
    test_endpoint("GET", "/patient/records", token=apollo_token, label="Patient: Records")
    test_endpoint("GET", "/patient/timeline", token=apollo_token, label="Patient: Timeline")
    test_endpoint("GET", "/patient/profile", token=apollo_token, label="Patient: Profile")
    test_endpoint("GET", "/patient/dashboard", token=apollo_token, label="Patient: Dashboard")
    test_endpoint("GET", "/patient/notifications", token=apollo_token, label="Patient: Notifications")
    
    # V1 Enterprise endpoints
    test_endpoint("GET", "/admin/stats", token=apollo_token, label="V1 Admin: Global Stats")
    test_endpoint("GET", "/admin/hospitals", token=apollo_token, label="V1 Admin: Hospitals")
    test_endpoint("GET", "/admin/audit-logs", token=apollo_token, label="V1 Admin: Audit Logs")
    test_endpoint("GET", "/admin/analytics", token=apollo_token, label="V1 Admin: Analytics")
    
    # Hospital Settings
    test_endpoint("GET", "/hospital-settings/", token=apollo_token, label="Hospital Settings")
    
    # Ward
    test_endpoint("GET", "/ward/beds", token=apollo_token, label="Ward: Beds")
    
    # Surgery
    test_endpoint("GET", "/surgery/schedule", token=apollo_token, label="Surgery: Schedule")
    
    # Lab
    # (no simple GET listing, skip)
    
    # Visit
    test_endpoint("GET", "/visit/active", token=apollo_token, label="Visit: Active")

# ═══════════════════════════════════════════════════════════════
# PHASE 5: Unauthenticated Access Control
# ═══════════════════════════════════════════════════════════════
print("\n[PHASE 5] Security — Unauthenticated access should be blocked...")
unauth_endpoints = [
    "/owner/dashboard",
    "/staff/members", 
    "/pharmacy/inventory",
    "/patient/records",
    "/doctor/profile",
]
for ep in unauth_endpoints:
    r, ms = test_endpoint("GET", ep, label=f"UNAUTH {ep}", expect_status=401)
    if r:
        if r.status_code == 401 or r.status_code == 403:
            print(f"  OK Blocked: {ep} — HTTP {r.status_code}")
        else:
            print(f"  SECURITY_ISSUE: {ep} returned HTTP {r.status_code} without auth!")

# ═══════════════════════════════════════════════════════════════
# PHASE 6: Frontend Reachability
# ═══════════════════════════════════════════════════════════════
print("\n[PHASE 6] Frontend Reachability...")
try:
    start = time.perf_counter()
    r = requests.get("http://localhost:5173/", timeout=10)
    ms = (time.perf_counter() - start) * 1000
    result = {
        "label": "Frontend (Vite Dev Server)",
        "status": r.status_code,
        "latency_ms": round(ms, 1),
        "speed": elapsed_color(ms),
        "ok": r.status_code == 200,
        "size_bytes": len(r.content)
    }
    RESULTS.append(result)
    print(f"  {'OK' if r.status_code == 200 else 'FAIL'} http://localhost:5173/ — HTTP {r.status_code} — {round(ms,1)}ms")
except Exception as e:
    print(f"  FAIL Frontend not reachable: {e}")
    ERRORS.append({"label": "Frontend (Vite Dev Server)", "status": "DEAD", "error": str(e), "ok": False})

# ═══════════════════════════════════════════════════════════════
# PHASE 7: CORS Check
# ═══════════════════════════════════════════════════════════════
print("\n[PHASE 7] CORS Check...")
try:
    r = requests.options(f"{BASE}/owner/dashboard", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization"
    }, timeout=10)
    cors_ok = "access-control-allow-origin" in r.headers
    origin_val = r.headers.get("access-control-allow-origin", "MISSING")
    print(f"  CORS Origin: {origin_val} — {'OK' if cors_ok else 'BLOCKED'}")
    if not cors_ok:
        ERRORS.append({"label": "CORS", "status": "BLOCKED", "ok": False, "error": "No Access-Control-Allow-Origin header"})
except Exception as e:
    print(f"  CORS check failed: {e}")

# ═══════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  FOG TEST REPORT")
print("=" * 70)

total = len(RESULTS)
passed = sum(1 for r in RESULTS if r.get("ok"))
failed = sum(1 for r in RESULTS if not r.get("ok"))
avg_latency = sum(r.get("latency_ms", 0) for r in RESULTS if r.get("latency_ms", 0) > 0) / max(1, sum(1 for r in RESULTS if r.get("latency_ms", 0) > 0))

print(f"\n  Total Tests:  {total}")
print(f"  Passed:       {passed}")
print(f"  Failed:       {failed}")
print(f"  Avg Latency:  {avg_latency:.1f}ms")
print()

# Latency breakdown
fast = sum(1 for r in RESULTS if r.get("speed") == "FAST")
ok_speed = sum(1 for r in RESULTS if r.get("speed") == "OK")
slow = sum(1 for r in RESULTS if r.get("speed") == "SLOW")
critical = sum(1 for r in RESULTS if r.get("speed") == "CRITICAL_LAG")
dead = sum(1 for r in RESULTS if r.get("speed") == "DEAD")

print(f"  Speed Distribution:")
print(f"    FAST (<200ms):     {fast}")
print(f"    OK (200-500ms):    {ok_speed}")
print(f"    SLOW (500-1500ms): {slow}")
print(f"    CRITICAL (>1.5s):  {critical}")
print(f"    DEAD (no resp):    {dead}")

if ERRORS:
    print(f"\n  --- ERRORS ({len(ERRORS)}) ---")
    for e in ERRORS:
        print(f"    FAIL  {e['label']} — HTTP {e.get('status','?')} — {e.get('error','')[:100]}")

if WARNINGS:
    print(f"\n  --- LATENCY WARNINGS ({len(WARNINGS)}) ---")
    for w in WARNINGS:
        print(f"    SLOW  {w['label']} — {w.get('latency_ms',0)}ms [{w.get('speed','')}]")

# Full results table
print(f"\n  --- FULL RESULTS ---")
print(f"  {'Label':<45} {'Status':<8} {'Latency':<12} {'Speed':<15}")
print(f"  {'-'*45} {'-'*8} {'-'*12} {'-'*15}")
for r in RESULTS:
    label = r.get("label","")[:44]
    st = str(r.get("status","?"))
    lat = f"{r.get('latency_ms',0):.0f}ms"
    speed = r.get("speed","")
    mark = "OK" if r.get("ok") else "FAIL"
    print(f"  {mark:<4} {label:<45} {st:<8} {lat:<12} {speed:<15}")

print("\n" + "=" * 70)
print("  FOG TEST COMPLETE")
print("=" * 70)
