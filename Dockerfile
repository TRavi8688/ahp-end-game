FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (gcc for psycopg2, postgresql-client for pg_isready)
RUN apt-get update && \
    apt-get install -y gcc libpq-dev postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy entrypoint and make executable
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Cloud Run requires the container to listen on $PORT (default 8080)
# Setting ENV here ensures it works even if Cloud Run doesn't inject it.
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
