import datetime
import mimetypes
import boto3
from google.cloud import storage
from app.core.config import settings
from app.core.logging import logger
from typing import Optional

class StorageService:
    """
    ENTERPRISE SECURE STORAGE: Supports both GCS and AWS S3.
    1. Objects are private by default.
    2. Access via short-lived signed URLs.
    3. Multi-cloud capable.
    """
    def __init__(self):
        self.provider = settings.CLOUD_PROVIDER.lower()
        if self.provider == "gcp":
            self.bucket_name = settings.GCS_BUCKET_NAME
            self.client = storage.Client(project=settings.GCP_PROJECT_ID)
            self.bucket = self.client.bucket(self.bucket_name)
        elif self.provider == "aws":
            self.bucket_name = settings.AWS_S3_BUCKET
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
        else:
            raise ValueError(f"Unsupported storage provider: {self.provider}")

    async def upload_bytes(self, content: bytes, object_name: str, mime_type: str = "application/octet-stream") -> str:
        try:
            if self.provider == "gcp":
                blob = self.bucket.blob(object_name)
                blob.upload_from_string(content, content_type=mime_type)
            else:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=object_name,
                    Body=content,
                    ContentType=mime_type
                )
            logger.info(f"{self.provider.upper()}_UPLOAD_SUCCESS", object=object_name)
            return object_name
        except Exception as e:
            logger.error(f"{self.provider.upper()}_UPLOAD_FAILURE", error=str(e))
            raise RuntimeError(f"Cloud storage upload failed: {e}")

    def get_signed_url(self, object_name: str, expires_in: int = 300) -> str:
        try:
            if self.provider == "gcp":
                blob = self.bucket.blob(object_name)
                return blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(seconds=expires_in),
                    method="GET",
                )
            else:
                return self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': object_name},
                    ExpiresIn=expires_in
                )
        except Exception as e:
            logger.error(f"{self.provider.upper()}_SIGNED_URL_FAILURE", error=str(e))
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
