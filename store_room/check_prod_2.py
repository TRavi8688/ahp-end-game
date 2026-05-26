import urllib.request
try:
    req = urllib.request.Request("https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app/health")
    with urllib.request.urlopen(req) as response:
        print("Health (7ixs2fhkna-uc):", response.read().decode())
except Exception as e:
    print("Health (7ixs2fhkna-uc) error:", e)

try:
    req = urllib.request.Request("https://hospyn-495906-api-7ixs2fhkna-uc.a.run.app/api/v1/pharmacy/ai-scan", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=b"{}") as response:
        print("AI Scan (7ixs2fhkna-uc):", response.read().decode())
except Exception as e:
    print("AI Scan (7ixs2fhkna-uc) error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
