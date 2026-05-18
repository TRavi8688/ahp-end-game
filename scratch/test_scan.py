import httpx
import json

def main():
    base_url = "https://hospyn-api-625745217419.asia-south1.run.app/api/v1"
    
    # 1. Login as doctor
    print("Attempting login...")
    login_data = {
        "email": "doctor@hospyn.com",
        "password": "Hospyn123!"
    }
    
    try:
        # Try form-data with the correct parameters expected by doctor/token compatibility endpoint
        resp = httpx.post(f"{base_url}/doctor/token", data={
            "identifier": "doctor@hospyn.com",
            "password_or_otp": "Hospyn123!",
            "is_otp": "false"
        })
            
        print("Login status:", resp.status_code)
        if resp.status_code != 200:
            print("Login failed completely. Response:", resp.text)
            return
            
        resp_json = resp.json()
        token = resp_json.get("access_token")
        print("Successfully obtained doctor token!")
        
        # 2. Call scan-patient
        headers = {
            "Authorization": f"Bearer {token}"
        }
        scan_payload = {
            "hospyn_id": "Hospyn-D0AAB75D",
            "clinic_name": "Apollo Clinic",
            "access_level": "read"
        }
        print("\nCalling /doctor/scan-patient...")
        scan_resp = httpx.post(f"{base_url}/doctor/scan-patient", json=scan_payload, headers=headers, timeout=30.0)
        print("Scan patient status:", scan_resp.status_code)
        print("Response body:", scan_resp.text)
        
    except Exception as e:
        print("Error during execution:", e)

if __name__ == "__main__":
    main()
