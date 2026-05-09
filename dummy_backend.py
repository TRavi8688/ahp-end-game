from fastapi import FastAPI, Form, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Hospyn 2.0 Dummy Backend")

# Enable CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    print("[MOCK] Root endpoint hit")
    return {"message": "Hospyn 2.0 Dummy Backend is running"}

# --- DOCTOR APP ENDPOINTS ---

@app.post("/api/v1/doctor/send-otp")
@app.post("/doctor/send-otp")
async def send_otp(request: Request):
    data = await request.json()
    print(f"[MOCK] Sending OTP for {data.get('identifier')} via {data.get('channel')}")
    return {"status": "success", "message": "OTP sent to dummy device"}

@app.post("/api/v1/doctor/token")
@app.post("/doctor/token")
async def login_token(request: Request):
    print("[MOCK] Token request received (Login)")
    return {
        "access_token": "dummy_token_abc_123",
        "token_type": "bearer"
    }

@app.get("/api/v1/doctor/profile/me")
@app.get("/doctor/profile/me")
async def get_profile():
    print("[MOCK] Fetching Doctor Profile")
    return {
        "first_name": "Dummy",
        "last_name": "Practitioner",
        "email": "doctor@example.com",
        "role": "doctor"
    }

@app.get("/api/v1/doctor/stats")
@app.get("/doctor/stats")
async def get_stats():
    print("[MOCK] Fetching Dashboard Stats")
    return {
        "patients_count": 12,
        "schedule_count": 5,
        "alerts_count": 1,
        "pending_rx_count": 3
    }

@app.get("/api/v1/doctor/my-patients")
@app.get("/doctor/my-patients")
async def get_my_patients():
    print("[MOCK] Fetching Patient List")
    return [
        {
            "hospyn_id": "Hospyn-IN-9284-7731",
            "name": "Rahul Sharma",
            "granted_at": "2026-03-15T09:00:00",
            "access_level": "full"
        },
        {
            "hospyn_id": "Hospyn-IN-1234-5678",
            "name": "Priya Patel",
            "granted_at": "2026-03-15T10:30:00",
            "access_level": "full"
        }
    ]

# --- PATIENT APP ENDPOINTS (Fallback) ---

@app.post("/api/v1/auth/login")
async def patient_login():
    return {
        "access_token": "dummy_patient_token",
        "user": {"first_name": "John", "last_name": "Doe", "role": "patient"}
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
