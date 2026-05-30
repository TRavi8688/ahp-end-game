from typing import Any, Dict, Optional
from fastapi.responses import JSONResponse


def success_response(
    data: Any = None, message: str = "Operation successful", status_code: int = 200
) -> JSONResponse:
    content = {
        "success": True,
        "message": message,
        "data": data if data is not None else {},
    }
    return JSONResponse(status_code=status_code, content=content)


def error_response(
    error_code: str, message: str, status_code: int = 400, details: Optional[Any] = None
) -> JSONResponse:
    content = {"success": False, "error_code": error_code, "message": message}
    if details:
        content["details"] = details
    return JSONResponse(status_code=status_code, content=content)
