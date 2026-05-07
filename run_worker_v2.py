import os
import sys
import asyncio
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# Ensure the root directory is in the path
sys.path.append(os.getcwd())

from arq import run_worker
from app.workers.arq_worker import WorkerSettings

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"OK")
    def log_message(self, format, *args):
        pass  # suppress access logs to keep worker logs clean

def run_health_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    server.serve_forever()

if __name__ == "__main__":
    print("Starting AHP 2.0 ARQ AI Worker (Enterprise Edition)...")
    try:
        # Start the health check server in a background thread
        print(f"Starting Cloud Run health check server on port {os.environ.get('PORT', 8080)}...")
        threading.Thread(target=run_health_server, daemon=True).start()

        # Python 3.14 FIX: Manually create and set the event loop before calling run_worker.
        # This satisfies arq's internal call to asyncio.get_event_loop() 
        # without triggering the "Loop already running" error from asyncio.run().
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        run_worker(WorkerSettings)
    except KeyboardInterrupt:
        print("\nWorker stopped by user.")
    except Exception as e:
        print(f"\nCRITICAL WORKER ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
