import urllib.request, json
try:
    req = urllib.request.Request("https://api.github.com/repos/TRavi8688/ahp-end-game/actions/runs")
    req.add_header("User-Agent", "Mozilla/5.0")
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if data['workflow_runs']:
            run = data['workflow_runs'][0]
            print(f"Latest run: {run['status']} - {run['conclusion']}")
            print(f"URL: {run['html_url']}")
            
            # Print the second latest run too
            if len(data['workflow_runs']) > 1:
                run2 = data['workflow_runs'][1]
                print(f"Previous run: {run2['status']} - {run2['conclusion']}")
        else:
            print("No runs found")
except Exception as e:
    print(f"Failed: {e}")
