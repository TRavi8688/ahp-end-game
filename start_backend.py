import os
import dotenv
import subprocess
import sys

# Load root .env
dotenv.load_dotenv()

# Force environment variables to development/local values
os.environ["ENV"] = "development"
os.environ["ENVIRONMENT"] = "development"
os.environ["UVICORN_WORKERS"] = "1"

# Ensure all secret keys and URLs are explicitly set from root .env or defaults
os.environ["DATABASE_URL"] = "postgresql+asyncpg://hospyn:0JPfr3cF891KUHRrikdzzw@127.0.0.1:5432/hospyn"
os.environ["REDIS_URL"] = "redis://127.0.0.1:6379/0"
os.environ["JWT_SECRET_KEY"] = "CtmCtxAI1YamIUP6Nt_WnqsOtin49UX-vK_ckmgf73qqPIFCnYW5yUdn7k5yDoeI9Oz8kqyQqa5ibCPCHW_llw"

print("[Launcher] Starting backend services with explicit development config...")
subprocess.run([sys.executable, "start_api.py"])
