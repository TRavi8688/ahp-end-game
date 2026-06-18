import httpx
import asyncio
import os

API_BASE = "http://localhost:8000/api/v1"

async def test_upload_hardening():
    print("\n--- Testing Hardened File Upload (Enterprise Standards) ---")
    url = f"{API_BASE}/patient/upload-report"
    
    # Note: These tests will return 401/403 if not authenticated, 
    # but we are looking for the 400 "Invalid file upload." for validation failures
    # or successful bypasses. In a real scenario, we'd use a test token.
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        
        # 1. Test Size Limit (5MB)
        print("Testing 6MB Upload...")
        large_content = b"0" * (6 * 1024 * 1024)
        files = {'file': ('large.pdf', large_content, 'application/pdf')}
        resp = await client.post(url, files=files)
        if resp.status_code == 400 and "Invalid file upload." in resp.text:
            print("[SECURE] 5MB Size Limit enforced.")
        else:
            print(f"[ISSUE] Size limit result: {resp.status_code}")

        # 2. Test Invalid Extension
        print("Testing .exe Upload...")
        files = {'file': ('malicious.exe', b"print('hack')", 'application/octet-stream')}
        resp = await client.post(url, files=files)
        if resp.status_code == 400:
            print("[SECURE] Invalid extension (.exe) rejected.")
        else:
            print(f"[ISSUE] Extension check result: {resp.status_code}")

        # 3. Test MIME Mismatch (Extension Spoofing)
        print("Testing .pdf extension with TXT content...")
        files = {'file': ('fake.pdf', b"This is just text code", 'application/pdf')}
        resp = await client.post(url, files=files)
        if resp.status_code == 400 and "Invalid file upload." in resp.text:
            print("[SECURE] Extension spoofing (PDF-extension/TXT-content) rejected.")
        else:
            print(f"[ISSUE] MIME check result: {resp.status_code}")

        # 4. Test Path Traversal in Filename
        print("Testing Path Traversal Filename...")
        files = {'file': ('../../traversal.pdf', b"%PDF-1.4\n%test", 'application/pdf')}
        resp = await client.post(url, files=files)
        # It should either be rejected or renamed securely
        print(f"[STATUS] Traversal filename status: {resp.status_code}")

        # 5. Test Valid PDF
        print("Testing Valid PDF Upload...")
        valid_pdf = b"%PDF-1.4\n%%EOF"
        files = {'file': ('report.pdf', valid_pdf, 'application/pdf')}
        resp = await client.post(url, files=files)
        # Expect 401 if no token, but it should HAVE PASSED the logic checks
        print(f"[STATUS] Valid PDF status (expect 401 if unauth, not 400): {resp.status_code}")

if __name__ == "__main__":
    asyncio.run(test_upload_hardening())
