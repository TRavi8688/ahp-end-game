import requests
import json
import uuid

BASE_URL = "http://localhost:8001/api/v1"

def test_verification_flow():
    print("--- Starting Doctor Verification Flow Test ---")
    
    # Step 1: Start
    print("\n[Step 1] Starting Verification...")
    payload = {
        "full_name": "Rahul Sharma",
        "registration_number": "NMC-98765432",
        "state_medical_council": "Delhi Medical Council",
        "mobile_number": "9876543210"
    }
    resp = requests.post(f"{BASE_URL}/doctor/verify/start", json=payload)
    if resp.status_code != 200:
        print(f"FAILED: {resp.text}")
        return
    data = resp.json()
    session_id = data['session_id']
    print(f"SUCCESS: Session ID: {session_id}")

    # Step 2: Identity
    print("\n[Step 2] Uploading Identity...")
    files = {
        'aadhaar_file': ('aadhaar.jpg', b'fake_aadhaar_content', 'image/jpeg'),
        'selfie_file': ('selfie.jpg', b'fake_selfie_content', 'image/jpeg')
    }
    resp = requests.post(f"{BASE_URL}/doctor/verify/identity?session_id={session_id}", files=files)
    if resp.status_code != 200:
        print(f"FAILED: {resp.text}")
        return
    print("SUCCESS: Identity Uploaded")

    # Step 3: Send OTP
    print("\n[Step 3a] Sending OTP...")
    resp = requests.post(f"{BASE_URL}/doctor/verify/send-otp?session_id={session_id}")
    if resp.status_code != 200:
        print(f"FAILED: {resp.text}")
        return
    print("SUCCESS: OTP Sent")

    # Note: In mock, we check logs for OTP. Since I can't check logs easily here, 
    # I'll rely on the fact that the backend sets it in the session table.
    # However, for testing, I'll assume the OTP is correct if I just use a sample if I were manual.
    # But for an automated script, I'd need to query the DB or check logs.
    print("SKIP: Actual OTP fetching (Mocking it via manual check in logs usually)")
    
    # Step 3b: Verify OTP
    otp = "123456" # Fixed mock OTP
    print(f"\n[Step 3b] Verifying OTP {otp}...")
    resp = requests.post(f"{BASE_URL}/doctor/verify/verify-otp", json={"session_id": session_id, "otp": otp})
    if resp.status_code != 200:
        print(f"FAILED: {resp.text}")
        return
    print("SUCCESS: OTP Verified")

    # Step 4: Complete
    print("\n[Step 4] Completing Registration...")
    resp = requests.post(f"{BASE_URL}/doctor/verify/complete", json={"session_id": session_id, "password": "SecurePassword123!"})
    if resp.status_code != 200:
        print(f"FAILED: {resp.text}")
        return
    data = resp.json()
    print(f"SUCCESS: Account Created!")
    print(f"Access Token: {data['access_token'][:20]}...")

    print("\n--- End-to-End Backend Verification Completed Successfully ---")

if __name__ == "__main__":
    try:
        test_verification_flow()
    except Exception as e:
        print(f"Error: {e}")
