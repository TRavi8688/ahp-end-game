import httpx
import time
import os
import re

def verify_performance():
    print("--- ⚡ PERFORMANCE VERIFICATION ---")
    try:
        start = time.time()
        # Ensure we hit the local server
        resp = httpx.get("http://localhost:8000/metrics", timeout=2.0)
        duration = time.time() - start
        if duration < 0.2:
            print(f"✅ [PASS] Metrics latency: {duration:.4f}s (Threshold < 0.2s)")
        else:
            print(f"❌ [FAIL] Metrics latency: {duration:.4f}s (Blocking detected?)")
    except Exception as e:
        print(f"⚠️ [WARN] Could not reach server for live test: {e}")

def verify_security_code():
    print("\n--- 🛡️ SECURITY CODE AUDIT ---")
    # Verify DOMPurify in Doctor App
    doctor_file = r"doctor-app\src\pages\PatientDetailView.js"
    if os.path.exists(doctor_file):
        with open(doctor_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if "DOMPurify.sanitize" in content:
                print("✅ [PASS] DOMPurify detected in PatientDetailView.js")
            else:
                print("❌ [FAIL] DOMPurify MISSING in PatientDetailView.js")
    
    # Verify non-blocking CPU in main.py
    main_file = r"app\main.py"
    if os.path.exists(main_file):
        with open(main_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if "interval=None" in content:
                print("✅ [PASS] Non-blocking psutil detected in main.py")
            else:
                print("❌ [FAIL] psutil is still blocking in main.py")

if __name__ == "__main__":
    verify_performance()
    verify_security_code()
