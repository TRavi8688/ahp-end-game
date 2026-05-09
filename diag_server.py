# Minimal diagnostic server to verify Railway environment and port binding
from fastapi import FastAPI
import os
import uvicorn

app = FastAPI()

@app.get("/health")
async def diagnostic_health():
    port = os.environ.get("PORT", "8000")
    print(f"DIAGNOSTIC: Health check hit on port {port}")
    return {"status": "diag_live", "port": port}

@app.get("/")
async def root():
    return {"message": "Hospyn Diagnostic Server is ALIVE"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"DIAGNOSTIC: Starting diagnostic server on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
