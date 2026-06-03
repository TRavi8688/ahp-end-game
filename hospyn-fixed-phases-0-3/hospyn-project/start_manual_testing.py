import subprocess
import time
import os
import sys

def start_process(command, cwd, name):
    print(f"[Launcher] Starting {name}...")
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.Popen(command, cwd=cwd, shell=True, env=env)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Start Backend Gateway & Services
    backend = start_process("python start_api.py", root_dir, "Backend API Gateway")
    time.sleep(4)  # Wait for auth and healthcare microservices to boot
    
    # 2. Start Staff Portal
    staff = start_process("npm run dev -- --port 5173", os.path.join(root_dir, "staff-portal"), "Staff Portal")
    
    # 3. Start Doctor App
    doctor = start_process("npm run dev -- --port 5174", os.path.join(root_dir, "doctor-app"), "Doctor App")
    
    # 4. Start Patient App
    patient = start_process("npm run web -- -c", os.path.join(root_dir, "patient-app"), "Patient App")
    
    print("\n" + "="*60)
    print("HOSPYN 2.0 ECOSYSTEM BOOTED FOR MANUAL TESTING")
    print("="*60)
    print("API Gateway:    http://localhost:8000")
    print("Staff Portal:   http://localhost:5173")
    print("Doctor App:     http://localhost:5174")
    print("Patient App:    Check patient-app terminal logs for active port")
    print("="*60)
    print("\nKeep this process running. To stop all services, press Ctrl+C or kill the task.")
    
    processes = [backend, staff, doctor, patient]
    try:
        while True:
            time.sleep(1)
            for p in processes:
                if p.poll() is not None:
                    pass
    except KeyboardInterrupt:
        print("\n[Launcher] Shutting down all services...")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        print("[Launcher] Cleanup complete.")

if __name__ == "__main__":
    main()
