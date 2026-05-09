import sys
import os
sys.path.append('.')

try:
    from app.services.ai_service import AsyncAIService, MedicalEntities
    print("SUCCESS: AsyncAIService and MedicalEntities imported successfully.")
except NameError as e:
    print(f"FAILURE: NameError during import: {e}")
    import traceback
    traceback.print_exc()
except Exception as e:
    print(f"FAILURE: Other error during import: {e}")
    import traceback
    traceback.print_exc()
