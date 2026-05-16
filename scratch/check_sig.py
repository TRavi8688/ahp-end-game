
import sys
import os
sys.path.append(os.getcwd())
from app.core.security import require_roles
import inspect

print(f"Signature: {inspect.signature(require_roles)}")
try:
    require_roles("admin", "hospital_admin")
    print("Call successful")
except TypeError as e:
    print(f"Call failed: {e}")
