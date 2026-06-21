import os
import subprocess
import time
import random

def crash_system():
    print("\n--- [CHAOS] Hospyn Chaos Monkey Unleashed ---")
    actions = ["KILL_API"]
    action = random.choice(actions)
    
    if action == "KILL_API":
        print("Crasher: Finding process on port 8000...")
        if os.name == "nt":
            # Find PID on port 8000
            try:
                output = subprocess.check_output("netstat -ano | findstr :8000", shell=True).decode()
                for line in output.splitlines():
                    if "LISTENING" in line:
                        pid = line.strip().split()[-1]
                        print(f"Crasher: Killing PID {pid} on port 8000...")
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True)
            except Exception as e:
                print(f"Crasher: Failed to kill by port: {e}")
        else:
            subprocess.run("fuser -k 8000/tcp", shell=True)
        print("Crasher: Backend API has been killed. Waiting for Self-Healing...")

if __name__ == "__main__":
    crash_system()
