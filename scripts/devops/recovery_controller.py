import httpx
import asyncio
import os
import subprocess
import time
from datetime import datetime

API_URL = "http://localhost:8000"
HEALTH_ENDPOINT = f"{API_URL}/health"
READY_ENDPOINT = f"{API_URL}/ready"
RETRY_LIMIT = 3
CHECK_INTERVAL = 5 # seconds

def log_recovery(action, details):
    timestamp = datetime.now().isoformat()
    log_line = f"[{timestamp}] [RECOVERY_CONTROLLER] {action} - {details}\n"
    print(log_line.strip())
    with open("secure_uploads/recovery_audit.log", "a") as f:
        f.write(log_line)

async def check_health():
    """Digital Hospital check-up logic."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(READY_ENDPOINT)
            if resp.status_code == 200:
                return True, "Ready"
            return False, f"Degraded (Status: {resp.status_code})"
        except Exception as e:
            return False, f"Unreachable ({type(e).__name__})"

async def heal_system():
    """Automated repair mechanism."""
    log_recovery("HEALING_TRIGGERED", "API unresponsiveness detected.")
    
    try:
        # 1. Surgical Kill by Port 8000
        if os.name == "nt": 
            try:
                output = subprocess.check_output("netstat -ano | findstr :8000", shell=True).decode()
                for line in output.splitlines():
                    if "LISTENING" in line:
                        pid = line.strip().split()[-1]
                        log_recovery("TERMINATING_PROCESS", f"Killing PID {pid} on port 8000")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True)
            except Exception:
                log_recovery("CLEANUP", "Port 8000 already clear.")
        else:
            subprocess.run("fuser -k 8000/tcp", shell=True)
        
        log_recovery("PROCESS_TERMINATED", "Hung API processes cleared.")
        
        # 2. Relaunch the service
        cmd = "poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000"
        # Use a more stable Popen for Windows
        subprocess.Popen(cmd, shell=True, creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
        
        log_recovery("SERVICE_RELAUNCHED", "API server started successfully.")
        
        # 3. Verify Healing
        await asyncio.sleep(8) 
        success, msg = await check_health()
        if success:
            log_recovery("HEALTH_RESTORED", "System confirmed stable.")
        else:
            log_recovery("HEALING_FAILED", f"Still unhealthy: {msg}")
            
    except Exception as e:
        log_recovery("ERROR_DURING_HEAL", str(e))

async def main():
    print(f"--- [HOSPITAL] Hospyn Self-Healing Controller Started (Interval: {CHECK_INTERVAL}s) ---")
    consecutive_failures = 0
    
    while True:
        healthy, status = await check_health()
        
        if healthy:
            consecutive_failures = 0
            # print(f"[{datetime.now().strftime('%H:%M:%S')}] System Healthy OK")
        else:
            consecutive_failures += 1
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ALERT: System Unhealthy ({status}) [{consecutive_failures}/{RETRY_LIMIT}] CRITICAL")
            
            if consecutive_failures >= RETRY_LIMIT:
                await heal_system()
                consecutive_failures = 0
        
        await asyncio.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    if not os.path.exists("secure_uploads"):
        os.makedirs("secure_uploads")
    asyncio.run(main())
