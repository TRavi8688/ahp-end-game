import requests

url = "https://api.github.com/repos/TRavi8688/ahp-end-game/actions/runs?per_page=3"
response = requests.get(url)
if response.status_code == 200:
    runs = response.json().get("workflow_runs", [])
    for run in runs:
        print(f"Run: {run['name']} - Status: {run['status']} - Conclusion: {run['conclusion']} - Updated: {run['updated_at']}")
else:
    print(f"Failed to fetch runs: {response.status_code}")
