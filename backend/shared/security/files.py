try:
    import magic

    _HAS_MAGIC = True
except ImportError:
    magic = None  # type: ignore[assignment]
    _HAS_MAGIC = False
import mimetypes
import structlog
from fastapi import HTTPException, status

logger = structlog.get_logger()

# Map of common safe extensions to their MIME types for healthcare platforms
ALLOWED_MIME_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "application/pdf": [".pdf"],
    "image/webp": [".webp"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx"
    ],
}


def validate_file_security(
    file_content: bytes,
    filename: str,
    max_size_bytes: int,
    allowed_types: list[str] = None,
) -> str:
    """
    Validates file content size, extension, and real MIME type using python-magic.
    Returns the detected/validated MIME type if valid, otherwise raises HTTPException.
    """
    # 1. Size Validation
    file_size = len(file_content)
    if file_size > max_size_bytes:
        max_mb = max_size_bytes / (1024 * 1024)
        logger.warning(
            "File upload rejected: Size limit exceeded",
            filename=filename,
            size_bytes=file_size,
            max_size_bytes=max_size_bytes,
        )
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {max_mb:.1f} MB.",
        )

    # 2. Extension Extraction
    dot_idx = filename.rfind(".")
    if dot_idx == -1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have an extension.",
        )
    ext = filename[dot_idx:].lower()

    # 3. MIME Type Detection via python-magic (buffer sniffing)
    detected_mime = None
    if _HAS_MAGIC:
        try:
            # Sniff first 2048 bytes for type detection
            sniff_content = file_content[:2048]
            detected_mime = magic.from_buffer(sniff_content, mime=True)
        except Exception as e:
            logger.warning(
                "python-magic failed to detect MIME type, falling back to mimetypes",
                error=str(e),
            )
            detected_mime, _ = mimetypes.guess_type(filename)
    else:
        # Fallback to standard mimetypes guess
        detected_mime, _ = mimetypes.guess_type(filename)

    if not detected_mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine file type.",
        )

    # Clean/normalize mime type string (sometimes magic adds charset or extra details)
    detected_mime = detected_mime.split(";")[0].strip().lower()

    # 4. Check against allowed types
    if allowed_types is None:
        allowed_types = list(ALLOWED_MIME_TYPES.keys())

    if detected_mime not in allowed_types:
        logger.warning(
            "File upload rejected: Disallowed MIME type",
            filename=filename,
            detected_mime=detected_mime,
        )
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{detected_mime}' is not supported.",
        )

    # 5. Cross-reference MIME type with extension to prevent masquerade (e.g. evil.exe renamed to safe.pdf)
    expected_exts = ALLOWED_MIME_TYPES.get(detected_mime, [])
    if ext not in expected_exts:
        logger.warning(
            "File upload rejected: Mismatched extension and MIME type",
            filename=filename,
            extension=ext,
            detected_mime=detected_mime,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File extension does not match its real content type.",
        )

    return detected_mime
