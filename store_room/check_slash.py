import urllib.request
try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/pharmacy/ai-scan/", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=b"{}") as response:
        print("AI Scan w/ slash:", response.read().decode())
except Exception as e:
    print("AI Scan w/ slash error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
