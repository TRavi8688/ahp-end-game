import urllib.request
try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/ai-scan", method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=b"{}") as response:
        print("Root AI Scan:", response.read().decode())
except Exception as e:
    print("Root AI Scan error:", getattr(e, 'code', e))

try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/api/v1/pharmacy/inventory", method="GET")
    with urllib.request.urlopen(req) as response:
        print("Pharmacy inventory:", len(response.read().decode()))
except Exception as e:
    print("Pharmacy inventory error:", getattr(e, 'code', e))
