import urllib.request, json
try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/openapi.json")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        paths = data.get("paths", {}).keys()
        for p in sorted(paths):
            if "pharmacy" in p.lower() or "scan" in p.lower():
                print(p)
except Exception as e:
    print("Error:", e)
