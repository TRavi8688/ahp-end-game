import requests
import json
import zipfile
import io

def main():
    url = "https://api.github.com/repos/TRavi8688/ahp-end-game/actions/runs?per_page=1"
    response = requests.get(url)
    if response.status_code == 200:
        runs = response.json().get("workflow_runs", [])
        if runs:
            run = runs[0]
            print(f"Latest Run: {run['name']} (ID: {run['id']}) - Status: {run['status']} - Conclusion: {run['conclusion']}")
            
            # Note: Fetching logs requires authentication (a PAT). Since I don't have it, I can't download the zip.
            # But wait, if the conclusion is 'success', then gcloud run deploy MUST HAVE SUCCEEDED!
            # GitHub actions fail the step if gcloud run deploy exits with a non-zero code.
        else:
            print("No runs found")
    else:
        print(f"Failed to fetch runs: {response.status_code}")

if __name__ == "__main__":
    main()
