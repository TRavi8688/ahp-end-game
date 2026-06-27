FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
# Build context is backend/ so this path is relative to that
COPY auth-service/requirements.txt ./auth-service/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r auth-service/requirements.txt

# Copy the full backend directory (includes auth-service/ and shared/)
COPY . .

# WORKDIR = /app/auth-service so uvicorn finds app.main:app
WORKDIR /app/auth-service

# PYTHONPATH must include:
#   /app              → so "from shared.xxx" resolves to /app/shared/
#   /app/auth-service → so "from app.xxx" resolves to /app/auth-service/app/
ENV PYTHONPATH=/app:/app/auth-service

# Cloud Run injects PORT at runtime (default 8080 if not set)
EXPOSE 8080

# Shell form so ${PORT} is expanded at runtime by Cloud Run
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
