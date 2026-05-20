import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings

def print_settings():
    print(f"[SETTINGS] Environment: {settings.ENVIRONMENT}")
    print(f"[SETTINGS] GCP Project ID: {settings.GCP_PROJECT_ID}")
    print(f"[SETTINGS] JWT Audience: {settings.JWT_AUDIENCE}")

if __name__ == "__main__":
    print_settings()
