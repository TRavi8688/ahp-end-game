from fastapi import Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from shared.utils.responses import error_response
import logging

logger = logging.getLogger(__name__)

async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(f"HTTP Exception: {exc.detail}")
    return error_response(
        error_code="HTTP_ERROR",
        message=str(exc.detail),
        status_code=exc.status_code
    )

from fastapi.encoders import jsonable_encoder

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation Error: {exc.errors()}")
    return error_response(
        error_code="VALIDATION_FAILED",
        message="Request validation failed.",
        status_code=422,
        details=jsonable_encoder(exc.errors())
    )

async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}", exc_info=True)
    return error_response(
        error_code="INTERNAL_SERVER_ERROR",
        message="An unexpected error occurred.",
        status_code=500
    )

def register_exception_handlers(app):
    app.add_exception_handler(StarletteHTTPException, custom_http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)
