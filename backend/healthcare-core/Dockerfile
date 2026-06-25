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
COPY healthcare-core/requirements.txt ./healthcare-core/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r healthcare-core/requirements.txt

# Copy the full backend directory (includes healthcare-core/ and shared/)
COPY . .

# WORKDIR = /app/healthcare-core so uvicorn finds app.main:app
WORKDIR /app/healthcare-core

# PYTHONPATH must include:
#   /app                   → so "from shared.xxx" resolves to /app/shared/
#   /app/healthcare-core   → so "from app.xxx" resolves to /app/healthcare-core/app/
ENV PYTHONPATH=/app:/app/healthcare-core

# Cloud Run injects PORT at runtime (default 8080 if not set)
EXPOSE 8080

# Run alembic migrations before starting uvicorn
CMD alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
