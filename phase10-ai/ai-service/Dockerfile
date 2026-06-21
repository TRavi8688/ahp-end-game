# ai-service/Dockerfile
# PHASE 10 FIX: AI Service microservice container
# (Previously this service was completely missing — documented in Blueprint but no code)

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Non-root user
RUN groupadd -r aiservice && useradd -r -g aiservice aiservice

COPY app/ ./app/

RUN chown -R aiservice:aiservice /app
USER aiservice

ENV PORT=8003

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
