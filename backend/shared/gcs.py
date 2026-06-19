"""
GCS Storage Service — Async-safe file uploads with local fallback.

All synchronous google-cloud-storage SDK calls are offloaded to a thread
pool executor so they never block the uvicorn async event loop.
"""

import asyncio
import functools
import os
import time
import structlog
from google.cloud import storage

logger = structlog.get_logger()


def _run_sync(func, *args, **kwargs):
    """Helper to run a sync function in the default thread pool executor."""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, functools.partial(func, *args, **kwargs))


class GCSStorageService:
    """
    Google Cloud Storage integration with automatic local filesystem fallback for development.
    All blocking I/O is offloaded to a thread pool executor.
    """

    def __init__(self, bucket_name: str = None):
        from app.config.settings import settings

        self.bucket_name = bucket_name or getattr(
            settings, "GCP_STORAGE_BUCKET", "hospyn-medical-records"
        )
        self.client = None
        self.local_fallback = False

        # Local storage directory path within the project
        root_dir = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        self.local_dir = os.path.join(root_dir, "secure_uploads")
        os.makedirs(self.local_dir, exist_ok=True)

        try:
            # Attempt to initialize GCP storage client
            self.client = storage.Client()
            logger.info(
                "GCP Storage Client initialized successfully", bucket=self.bucket_name
            )
        except Exception as e:
            logger.warning(
                "GCP Storage Client initialization failed, using local filesystem fallback",
                error=str(e),
            )
            self.local_fallback = True

    def _write_local(self, local_path: str, file_content: bytes) -> None:
        """Synchronous local file write — called inside executor."""
        with open(local_path, "wb") as f:
            f.write(file_content)

    def _upload_to_gcs(
        self, bucket_name: str, object_name: str, file_content: bytes, content_type: str
    ) -> str:
        """Synchronous GCS upload — called inside executor."""
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        blob.upload_from_string(file_content, content_type=content_type)
        return f"gs://{bucket_name}/{object_name}"

    def _generate_signed_url(
        self, bucket_name: str, blob_name: str, expires_in: int
    ) -> str:
        """Synchronous signed URL generation — called inside executor."""
        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.generate_signed_url(
            version="v4", expiration=int(time.time() + expires_in), method="GET"
        )

    async def upload_file_bytes(
        self, file_content: bytes, object_name: str, content_type: str
    ) -> str:
        """
        Uploads file bytes to GCP Storage or falls back to local storage.
        Returns the gs:// URI or local:// identifier.
        Non-blocking: all I/O runs in a thread pool executor.
        """
        safe_object_name = object_name.replace("\\", "/")

        if self.local_fallback:
            local_filename = safe_object_name.replace("/", "_")
            local_path = os.path.join(self.local_dir, local_filename)
            await _run_sync(self._write_local, local_path, file_content)
            logger.info(
                "File uploaded locally (GCP fallback)",
                object_name=safe_object_name,
                filename=local_filename,
            )
            return f"local://{local_filename}"

        try:
            uri = await _run_sync(
                self._upload_to_gcs,
                self.bucket_name,
                safe_object_name,
                file_content,
                content_type,
            )
            logger.info(
                "File uploaded to GCP Storage",
                bucket=self.bucket_name,
                object_name=safe_object_name,
            )
            return uri
        except Exception as e:
            logger.error(
                "GCP Storage upload failed, attempting local fallback", error=str(e)
            )
            local_filename = safe_object_name.replace("/", "_")
            local_path = os.path.join(self.local_dir, local_filename)
            await _run_sync(self._write_local, local_path, file_content)
            return f"local://{local_filename}"

    async def get_secure_url(self, object_url: str, expires_in: int = 600) -> str:
        """
        Generates a secure GCS Signed URL. Falls back to a local endpoint in dev.
        Non-blocking: signed URL generation runs in a thread pool executor.
        """
        if not object_url:
            return ""

        if object_url.startswith("local://"):
            filename = object_url.replace("local://", "")
            return f"/api/v1/patient/records/preview/{filename}"

        if not object_url.startswith("gs://"):
            if object_url.startswith("http://") or object_url.startswith("https://"):
                return object_url
            return ""

        try:
            path = object_url.replace("gs://", "")
            parts = path.split("/", 1)
            bucket_name = parts[0]
            blob_name = parts[1]

            url = await _run_sync(
                self._generate_signed_url, bucket_name, blob_name, expires_in
            )
            return url
        except Exception as e:
            logger.warning(
                "Failed to generate GCP Signed URL, returning raw URI",
                error=str(e),
                url=object_url,
            )
            return object_url
