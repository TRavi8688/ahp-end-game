import requests

url = "https://hospyn-495906-api-625745217419.us-central1.run.app/health"
try:
    res = requests.get(url, timeout=5)
    print(f"Health Status: {res.status_code}")
    print(f"Response: {res.text}")
except Exception as e:
    print(f"Error connecting: {e}")
