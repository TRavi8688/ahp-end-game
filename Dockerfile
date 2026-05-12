# --- PHASE 3: CLOUD RUN HARDENING ---
# Optimized for Google Cloud Run (Single Worker / High Concurrency)

FROM python:3.11-slim-bookworm

# 1. Environment Lockdown
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8080 \
    ENVIRONMENT=production

WORKDIR /app

# 2. System Dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    tesseract-ocr \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 3. Dependency Management (Cached Layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. App Source
COPY . .

# 5. Security: Non-Root Execution
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser

# 6. Port Documentation
EXPOSE 8080

# 7. Cloud Run Optimized Startup
# - Using exec form for proper signal propagation (SIGTERM)
# - Single worker as per Cloud Run best practices (let Cloud Run handle scaling)
# - High timeout to prevent uvicorn from killing slow boots
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 65"]

# 8. Readiness Verification
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1
