import urllib.request
import json
try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/health")
    with urllib.request.urlopen(req) as response:
        print("Health check response:", response.read().decode())
except Exception as e:
    print("Health check failed:", e)

try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/pharmacy/ai-scan", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=b"{}") as response:
        print("AI Scan response:", response.read().decode())
except Exception as e:
    print("AI Scan error:", e)
