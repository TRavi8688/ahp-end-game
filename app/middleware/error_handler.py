import uuid
import traceback
from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.core.logging import logger

async def global_exception_handler(request: Request, exc: Exception):
    """
    ENTERPRISE ERROR ORCHESTRATOR:
    Catches all unhandled exceptions, logs full tracebacks, 
    and returns a structured JSON response to the client.
    """
    trace_id = str(uuid.uuid4())
    
    # 1. Capture full traceback for forensic logging
    tb = traceback.format_exc()
    logger.error(f"UNHANDLED_EXCEPTION: {str(exc)} | trace_id={trace_id}\n{tb}")

    # 2. Determine status code and user-friendly message
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "INTERNAL_SERVER_ERROR"
    message = "An unexpected error occurred in the Hospyn engine."

    # Handle common FastAPI/SQLAlchemy errors if needed here
    if "Connection refused" in str(exc):
        error_code = "DB_CONNECTION_FAILURE"
        message = "Clinical database is temporarily unreachable."
    
    # 4. Automated Incident Classification (Priority 3)
    from app.services.incident_service import incident_service
    if status_code >= 500:
        await incident_service.declare_incident(
            severity=incident_service.SEV_1,
            component="GLOBAL_BACKEND",
            description=str(exc),
            trace_id=trace_id
        )
        playbook = await incident_service.get_recovery_playbook(incident_service.SEV_1, "GLOBAL_BACKEND")
        logger.info(f"RECOVERY_PLAYBOOK_STAGED: {playbook}")

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "trace_id": trace_id
            },
            "path": request.url.path
        }
    )
