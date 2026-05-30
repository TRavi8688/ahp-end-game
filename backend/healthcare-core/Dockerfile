FROM python:3.11-slim

WORKDIR /app

COPY healthcare-core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set WORKDIR to the microservice folder so uvicorn app.main works
WORKDIR /app/healthcare-core

# Set PYTHONPATH to allow importing from shared (which is in /app)
ENV PYTHONPATH=/app
ENV PORT=8002

EXPOSE 8002

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
