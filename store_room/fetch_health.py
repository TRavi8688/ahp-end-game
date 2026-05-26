import urllib.request, json
try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/health")
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print("Health error:", getattr(e, 'code', e))
    if hasattr(e, 'read'):
        print(e.read().decode())
