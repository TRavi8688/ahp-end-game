import datetime
import mimetypes
import asyncio
from typing import Optional
from app.core.config import settings
from app.core.logging import logger

# Conditional imports for cloud libraries
try:
    from google.cloud import storage as gcs_storage
except ImportError:
    gcs_storage = None

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception

class StorageService:
    """
    ENTERPRISE SECURE STORAGE: Provider-agnostic implementation (GCP/AWS).
    1. Objects are private by default.
    2. Access is ONLY granted via short-lived signed URLs.
    """
    def __init__(self):
        self.provider = settings.CLOUD_PROVIDER.lower()
        
        if self.provider == "gcp":
            if not gcs_storage:
                raise ImportError("GCP storage library 'google-cloud-storage' not installed.")
            self.bucket_name = settings.GCS_BUCKET_NAME
            self.client = gcs_storage.Client(project=settings.GCP_PROJECT_ID)
            self.bucket = self.client.bucket(self.bucket_name)
            
        elif self.provider == "aws":
            if not boto3:
                raise ImportError("AWS storage library 'boto3' not installed.")
            self.bucket_name = settings.S3_BUCKET_NAME or settings.AWS_S3_BUCKET
            # Auth via explicit keys or IAM Role (Environment Variables)
            self.client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
        else:
            raise ValueError(f"Unsupported storage provider: {self.provider}")

    async def upload_bytes(self, content: bytes, object_name: str, mime_type: str = "application/octet-stream") -> str:
        """Uploads bytes to private bucket (GCS or S3)."""
        # Wrapping blocking I/O in a thread for enterprise stability
        def _sync_upload():
            if self.provider == "gcp":
                blob = self.bucket.blob(object_name)
                blob.upload_from_string(content, content_type=mime_type)
            else:
                self.client.put_object(
                    Bucket=self.bucket_name,
                    Key=object_name,
                    Body=content,
                    ContentType=mime_type
                )
        
        try:
            await asyncio.to_thread(_sync_upload)
            logger.info("STORAGE_UPLOAD_SUCCESS", provider=self.provider, object=object_name)
            return object_name
        except Exception as e:
            logger.error("STORAGE_UPLOAD_FAILURE", provider=self.provider, error=str(e))
            raise RuntimeError(f"Cloud storage upload failed: {e}")

    async def upload_stream(self, file_obj, object_name: str, mime_type: str = "application/octet-stream") -> str:
        """Uploads a file-like object using streaming to preserve memory (Cloud Run optimized)."""
        def _sync_stream():
            if self.provider == "gcp":
                blob = self.bucket.blob(object_name)
                blob.upload_from_file(file_obj, content_type=mime_type)
            else:
                self.client.upload_fileobj(
                    file_obj,
                    self.bucket_name,
                    object_name,
                    ExtraArgs={'ContentType': mime_type}
                )

        try:
            await asyncio.to_thread(_sync_stream)
            logger.info("STORAGE_STREAM_SUCCESS", provider=self.provider, object=object_name)
            return object_name
        except Exception as e:
            logger.error("STORAGE_STREAM_FAILURE", provider=self.provider, error=str(e))
            raise RuntimeError(f"Cloud storage stream failed: {e}")

    def get_signed_url(self, object_name: str, expires_in: int = 300) -> str:
        """Generates a temporary secure link (V4 signed)."""
        try:
            if self.provider == "gcp":
                blob = self.bucket.blob(object_name)
                return blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(seconds=expires_in),
                    method="GET",
                )
            else:
                return self.client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': object_name},
                    ExpiresIn=expires_in
                )
        except Exception as e:
            logger.error("STORAGE_SIGNED_URL_FAILURE", provider=self.provider, error=str(e))
            raise RuntimeError(f"Failed to generate secure link: {e}")

async def upload_bytes_async(content: bytes, object_name: str, mime_type: str = "application/octet-stream") -> str:
    service = StorageService()
    return await service.upload_bytes(content, object_name, mime_type)

async def get_secure_url(object_name: str, expires_in: int = 300) -> str:
    service = StorageService()
    return service.get_signed_url(object_name, expires_in)

async def upload_to_cloud_async(file_path: str, object_name: str) -> str:
    """Secure wrapper for local file uploads to cloud storage."""
    with open(file_path, "rb") as f:
        content = f.read()
    mime_type, _ = mimetypes.guess_type(file_path)
    return await upload_bytes_async(content, object_name, mime_type or "application/octet-stream")
