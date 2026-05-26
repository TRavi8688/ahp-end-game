import urllib.request
import threading
import time
import subprocess
import sys

def run_server():
    subprocess.run([sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8001"])

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(3)

try:
    req = urllib.request.Request("http://127.0.0.1:8001/api/v1/pharmacy/ai-scan", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=b"{}") as response:
        print("AI Scan LOCAL:", response.read().decode())
except Exception as e:
    print("AI Scan LOCAL error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
