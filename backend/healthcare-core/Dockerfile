FROM python:3.11-slim

WORKDIR /app

COPY healthcare-core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set WORKDIR to the microservice folder so uvicorn app.main works
WORKDIR /app/healthcare-core

# Set PYTHONPATH to allow importing from shared (which is in /app)
ENV PYTHONPATH=/app
ENV PORT=${PORT}

EXPOSE 8002

CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
