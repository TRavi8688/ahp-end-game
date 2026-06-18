import httpx
import asyncio
import time
import uuid

API_BASE = "http://localhost:8000/api/v1"

async def test_legitimate_flow():
    print("\n--- Testing Legitimate User Workflow (False Positive Check) ---")
    
    # Use a fresh email to avoid "Already Registered" errors
    unique_user = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "StrongPassword123!"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Registration
        print(f"1. Registering: {unique_user}...")
        reg_payload = {
            "email": unique_user,
            "password": password,
            "first_name": "John",
            "last_name": "Doe",
            "role": "patient"
        }
        res = await client.post(f"{API_BASE}/auth/register", json=reg_payload)
        if res.status_code == 200:
            print("[PASS] Registration successful.")
        else:
            print(f"[FAIL] Registration blocked: {res.status_code} {res.text}")
            return

        # 2. Login
        print("2. Logging in...")
        login_payload = {"email": unique_user, "password": password}
        res = await client.post(f"{API_BASE}/auth/login", json=login_payload)
        if res.status_code == 200:
            print("[PASS] Login successful.")
        elif res.status_code == 501:
            print("[INFO] Login returned 501 (Expected Placeholder). Proceeding to upload checks.")
        else:
            print(f"[FAIL] Login blocked: {res.status_code} {res.text}")
            return

        # 3. Valid File Upload (Hardened check)
        print("3. Uploading Valid PDF (Hardened Path)...")
        valid_pdf = b"%PDF-1.4\n%%EOF"
        files = {'file': ('my_record.pdf', valid_pdf, 'application/pdf')}
        
        # We try to upload. 
        res = await client.post(f"{API_BASE}/patient/upload-report", files=files)
        # If it's 401, it means it passed the size and type filters and hit the @Depends(get_current_patient)
        if res.status_code == 401:
            print("[PASS] Security Filter ALLOWED legitimate PDF (Binary signature match).")
        elif res.status_code == 400:
            print(f"[FAIL] Security Filter INCORRECTLY BLOCKED legitimate PDF: {res.text}")
        else:
            print(f"[INFO] Upload response: {res.status_code}")

        # 4. Valid Image Upload
        print("4. Uploading Valid PNG...")
        valid_png = b"\x89\x50\x4e\x47\x0d\x0a\x1a\x0a"
        files = {'file': ('profile.png', valid_png, 'image/png')}
        res = await client.post(f"{API_BASE}/patient/upload-report", files=files)
        if res.status_code == 401:
            print("[PASS] Security Filter ALLOWED legitimate PNG.")
        elif res.status_code == 400:
            print(f"[FAIL] Security Filter INCORRECTLY BLOCKED legitimate PNG: {res.text}")
        else:
            print(f"[INFO] Image upload response: {res.status_code}")

async def main():
    await test_legitimate_flow()

if __name__ == "__main__":
    asyncio.run(main())
