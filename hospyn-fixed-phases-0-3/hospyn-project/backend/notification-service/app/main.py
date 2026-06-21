from fastapi import FastAPI
from app.api.v1.notify import router as notify_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hospyn Notification Service", version="1.0.0")
app.include_router(notify_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "notification-service"}
