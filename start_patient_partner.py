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
    
    # 1. Start Backend
    backend = start_process("python start_api.py", root_dir, "Backend API")
    time.sleep(4)
    
    # 2. Start Partner App
    partner = start_process("npm run dev", os.path.join(root_dir, "partner-app"), "Partner App")
    
    # 3. Start Patient App
    patient = start_process("npm run web", os.path.join(root_dir, "patient-app"), "Patient App")
    
    print("\n" + "="*50)
    print("HOSPYN DEMO ECOSYSTEM STARTED")
    print("="*50)
    print("Backend API:   http://localhost:8000")
    print("Partner App:   http://localhost:5174")
    print("Patient App:   (Check terminal below for Patient App web port)")
    print("="*50)
    print("\nPress Ctrl+C to stop all services.")
    
    processes = [backend, partner, patient]
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Launcher] Stopping all services...")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        print("[Launcher] Cleanup complete.")

if __name__ == "__main__":
    main()
