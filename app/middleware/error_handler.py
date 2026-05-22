import uuid
import traceback
from fastapi import Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from app.core.logging import logger

async def db_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    DATABASE EXCEPTION HANDLER:
    Catches all database errors (SQLAlchemy/DBAPI exceptions),
    logs the secure trace for debugging, but returns a masked
    sanitized message to the client to avoid leaking schema details.
    """
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    tb = traceback.format_exc()
    logger.error(f"DATABASE_EXCEPTION: {str(exc)} | trace_id={trace_id}\n{tb}")

    # Determine specific database failure codes safely
    error_code = "DATABASE_ERROR"
    message = "A secure database integrity or operation failure occurred."
    
    if "unique constraint" in str(exc).lower() or "integrityerror" in type(exc).__name__.lower():
        error_code = "DATABASE_INTEGRITY_VIOLATION"
        message = "A unique constraint or relational integrity check failed."
    elif "connection refused" in str(exc).lower():
        error_code = "DB_CONNECTION_FAILURE"
        message = "Clinical database is temporarily unreachable."

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "trace_id": trace_id
            },
            "path": request.url.path,
            "detail": message
        }
    )

async def http_exception_handler(request: Request, exc: HTTPException):
    """
    HTTP EXCEPTION HANDLER:
    Standardizes FastAPI HTTPExceptions into unified error JSON format.
    """
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    
    # Map status codes to clear error codes
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        429: "RATE_LIMIT_EXCEEDED"
    }
    error_code = code_map.get(exc.status_code, "HTTP_ERROR")

    # If the detail is a dict containing a custom error code, preserve it
    message = exc.detail
    details = None
    if isinstance(exc.detail, dict):
        error_code = exc.detail.get("error_code", error_code)
        message = exc.detail.get("message", str(exc.detail))
        details = exc.detail

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "trace_id": trace_id,
                **({"details": details} if details else {})
            },
            "path": request.url.path,
            "detail": message
        }
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    VALIDATION EXCEPTION HANDLER:
    Standardizes FastAPI RequestValidationError into unified error JSON format.
    """
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    
    # Sanitize exception ctx elements to avoid serialization issues
    errors = exc.errors()
    sanitized_errors = []
    for err in errors:
        new_err = err.copy()
        if "ctx" in new_err and isinstance(new_err["ctx"], dict):
            new_ctx = {}
            for k, v in new_err["ctx"].items():
                if isinstance(v, Exception):
                    new_ctx[k] = str(v)
                else:
                    new_ctx[k] = v
            new_err["ctx"] = new_ctx
        sanitized_errors.append(new_err)

    logger.warning(f"VALIDATION_ERROR: {sanitized_errors} | trace_id={trace_id}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_FAILED",
                "message": "The request payload failed validation checks.",
                "trace_id": trace_id,
                "details": sanitized_errors
            },
            "path": request.url.path,
            "detail": sanitized_errors
        }
    )

async def global_exception_handler(request: Request, exc: Exception):
    """
    ENTERPRISE ERROR ORCHESTRATOR:
    Catches all unhandled exceptions, logs full tracebacks,
    declares incidents for Sev-1, and returns a structured JSON response.
    """
    trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
    tb = traceback.format_exc()
    logger.error(f"UNHANDLED_EXCEPTION: {str(exc)} | trace_id={trace_id}\n{tb}")

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = "INTERNAL_SERVER_ERROR"
    message = "An unexpected error occurred in the Hospyn engine."

    # Handle connection failures gracefully
    if "connection refused" in str(exc).lower():
        error_code = "DB_CONNECTION_FAILURE"
        message = "Clinical database is temporarily unreachable."

    # Automated Incident Classification for 5xx errors
    try:
        from app.services.incident_service import incident_service
        await incident_service.declare_incident(
            severity=incident_service.SEV_1,
            component="GLOBAL_BACKEND",
            description=str(exc),
            trace_id=trace_id
        )
        playbook = await incident_service.get_recovery_playbook(incident_service.SEV_1, "GLOBAL_BACKEND")
        logger.info(f"RECOVERY_PLAYBOOK_STAGED: {playbook}")
    except Exception as inc_e:
        logger.error(f"INCIDENT_DECLARATION_FAILED: {inc_e}")

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": error_code,
                "message": message,
                "trace_id": trace_id
            },
            "path": request.url.path,
            "detail": message
        }
    )
