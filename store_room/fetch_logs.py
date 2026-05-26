import urllib.request, json
import sys

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
        target_job_id = None
        for job in jobs_data.get('jobs', []):
            if job['name'] == 'Deploy Backend & Database':
                target_job_id = job['id']
                break
                
    if target_job_id:
        req_logs = urllib.request.Request(f"https://api.github.com/repos/TRavi8688/ahp-end-game/actions/jobs/{target_job_id}/logs")
        req_logs.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req_logs) as response:
            print(response.read().decode())
    else:
        print("Job not found")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
except Exception as e:
    print(f"Failed: {e}")
