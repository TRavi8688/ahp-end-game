import urllib.request, json
try:
    req = urllib.request.Request("https://api.github.com/repos/TRavi8688/ahp-end-game/actions/runs")
    req.add_header("User-Agent", "Mozilla/5.0")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        run_id = data['workflow_runs'][0]['id']
        
    req_jobs = urllib.request.Request(f"https://api.github.com/repos/TRavi8688/ahp-end-game/actions/runs/{run_id}/jobs")
    req_jobs.add_header("User-Agent", "Mozilla/5.0")
    with urllib.request.urlopen(req_jobs) as response:
        jobs_data = json.loads(response.read().decode())
        for job in jobs_data.get('jobs', []):
            print(f"Job: {job['name']}, Status: {job['status']}, Conclusion: {job['conclusion']}")
except Exception as e:
    print(f"Failed: {e}")
