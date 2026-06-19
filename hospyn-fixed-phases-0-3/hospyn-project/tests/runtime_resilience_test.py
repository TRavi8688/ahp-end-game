import asyncio
import os
import sys
from unittest.mock import MagicMock, patch, AsyncMock
from starlette.requests import Request

# Add project root to path
sys.path.append(os.getcwd())

async def test_backpressure_isolation():
    print("[TEST] Backpressure Isolation (DEBUG)...")
    mock_redis = AsyncMock()
    mock_redis.llen.return_value = 120
    
    print("  -> Patching arq.create_pool...")
    with patch("arq.create_pool", AsyncMock(return_value=mock_redis)):
        print("  -> Importing upload_report...")
        from app.api.patient import upload_report
        from fastapi import HTTPException
        
        print("  -> Creating real Request object...")
        scope = {
            'type': 'http',
            'method': 'POST',
            'path': '/patient/upload-report',
            'headers': [],
            'app': MagicMock()
        }
        real_request = Request(scope)
        
        print("  -> Executing upload_report...")
        try:
            await upload_report(real_request, MagicMock(), AsyncMock(), MagicMock(id=1))
            print("  -> FAIL: Request succeeded but should have been rejected.")
        except HTTPException as e:
            if e.status_code == 503:
                print(f"  -> SUCCESS: Rejected with 503 (Queue: 120).")
                return True
            else:
                print(f"  -> FAIL: Got unexpected status {e.status_code}")
        except Exception as e:
            print(f"  -> ERROR: {type(e).__name__}: {e}")
            
    return False

if __name__ == "__main__":
    asyncio.run(test_backpressure_isolation())
