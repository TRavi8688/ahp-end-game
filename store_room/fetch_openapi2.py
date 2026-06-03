import urllib.request, json
try:
    req = urllib.request.Request("https://hospyn-495906-api-625745217419.us-central1.run.app/openapi.json")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        paths = list(data.get("paths", {}).keys())
        print(f"Total paths: {len(paths)}")
        for p in paths[:30]:
            print(p)
except Exception as e:
    print("Error:", e)
