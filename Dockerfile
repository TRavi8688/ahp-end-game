FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Secure non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/secure_uploads /app/uploads && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
# Use shell form of CMD to ensure $PORT expansion, but use 'exec' to handle signals properly
CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT

