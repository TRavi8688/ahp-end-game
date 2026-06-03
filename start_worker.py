import os
import subprocess
import sys

def run_worker():
    """Starts the ARQ worker process."""
    print("Starting Hospyn 2.0 ARQ Worker Pool...")
    # arq app.workers.arq_worker.WorkerSettings
    try:
        subprocess.run(["arq", "app.workers.arq_worker.WorkerSettings"], check=True)
    except KeyboardInterrupt:
        print("Worker stopped.")
    except Exception as e:
        print(f"Worker Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_worker()
