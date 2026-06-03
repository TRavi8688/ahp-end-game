from locust import HttpUser, task, between, events
import json
import uuid
import random

# Load Testing Hospital Workflow Simulation
# To run: locust -f scripts/load_tests/locustfile.py --headless -u 50 -r 5 --run-time 15m --host http://localhost:8000

class HospitalStaffUser(HttpUser):
    wait_time = between(1, 5) # Simulating human think time
    
    def on_start(self):
        """
        On start, every simulated user tries to login.
        We expect many of these to hit the 429 Too Many Requests rate limit gracefully.
        """
        self.token = None
        self.patient_ids = []
        # Attempt to login using dummy credentials
        # (Assuming the system handles invalid logins quickly, or we inject a real test user)
        # We use intentionally bad credentials just to stress the auth and rate limiter
        res = self.client.post("/api/v1/auth/login", data={
            "username": f"doctor_{random.randint(1,100)}@hospyn.com",
            "password": "wrongpassword"
        }, catch_response=True)
        
        if res.status_code == 429:
            res.success() # 429 is an expected success for our rate limiting test!
        elif res.status_code == 401:
            res.success() # Also expected for bad credentials

    @task(3)
    def healthcheck(self):
        """Simulate load balancer health checks and simple polling"""
        self.client.get("/api/v1/health")

    @task(2)
    def fetch_patients(self):
        """Simulate a doctor scrolling through the patient list"""
        # If we had a token, we'd pass it. For now we just test the unauthorized bounce
        # to ensure the auth dependency doesn't leak memory.
        headers = {"Authorization": "Bearer invalid_token"}
        res = self.client.get("/api/v1/clinical/patients", headers=headers, catch_response=True)
        if res.status_code in [401, 403]:
            res.success()

    @task(1)
    def attempt_billing(self):
        """Simulate an attempt to generate an invoice"""
        headers = {"Authorization": "Bearer invalid_token"}
        payload = {
            "patient_id": str(uuid.uuid4()),
            "items": [{"name": "Consultation", "price": 500, "quantity": 1}],
            "total_amount": 500
        }
        res = self.client.post("/api/v1/billing/invoices", json=payload, headers=headers, catch_response=True)
        if res.status_code in [401, 403, 422]:
            res.success()

    @task(1)
    def queue_polling(self):
        """Simulate the receptionist dashboard aggressively polling the queue"""
        # Simulate /api/v1/clinical/queue which might not exist, but testing 404/401 bounce rate
        headers = {"Authorization": "Bearer invalid_token"}
        branch_id = str(uuid.uuid4())
        res = self.client.get(f"/api/v1/clinical/queue/{branch_id}", headers=headers, catch_response=True)
        if res.status_code in [401, 403, 404]:
            res.success()

@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("Load Test Finished. Check DB connection pool and Asyncio warnings.")
