import os
os.environ["ENVIRONMENT"] = "production"
import traceback

try:
    from app.main import app
    print("OK")
except Exception as e:
    print("CRASH!")
    traceback.print_exc()
