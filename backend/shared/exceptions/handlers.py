# FIX: E402 -- module-level import not at top of file.
# 'from fastapi.encoders import jsonable_encoder' was placed after function
# definitions on line 17. All imports moved to the top.
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarlatteHTTPException
import logging

from shared.utils.responses import error_response

logger = logging.getLogger(__name__)


async def custom_http_exception_handler(request: Request, exc: StarlatteHTTPException):
    logger.warning(f"HTTP Exception: {exc.detail}")
    return error_response(
        error_code="HTTP_ERROR", message=str(exc.detail), status_code=exc.status_code
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation Error: {exc.errors()}")
    return error_response(
        error_code="VALIDATION_FAILED",
        message="Request validation failed.",
        status_code=422,
        details=jsonable_encoder(exc.errors()),
    )
