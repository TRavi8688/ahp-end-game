import subprocess
import time
import os
import sys

def start_process(command, cwd, name):
    print(f"[Launcher] Starting {name}...")
    return subprocess.Popen(command, cwd=cwd, shell=True)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Start Backend
    backend = start_process("python start_api.py", root_dir, "Backend API")
    time.sleep(3)
    
    # 2. Start Doctor App
    doctor = start_process("npm run start", os.path.join(root_dir, "doctor-app"), "Doctor App")
    
    # 3. Start Patient App
    patient = start_process("npm run web", os.path.join(root_dir, "patient-app"), "Patient App")
    
    print("\n" + "="*50)
    print("Hospyn 2.0 ECOSYSTEM STARTED")
    print("="*50)
    print("Backend API:   http://localhost:8000")
    print("Doctor App:    http://localhost:3000")
    print("Patient App:   http://localhost:19006")
    print("="*50)
    print("\nPress Ctrl+C to stop all services.")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Launcher] Stopping all services...")
        backend.terminate()
        doctor.terminate()
        patient.terminate()
        print("[Launcher] Cleanup complete.")

if __name__ == "__main__":
    main()
