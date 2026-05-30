# Hospyn API - Cloud Run optimised build
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y gcc libpq-dev postgresql-client tesseract-ocr && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user for security
RUN groupadd -r hospyn && useradd -r -g hospyn hospyn

# Copy application code
COPY . .

# Copy entrypoint and fix line endings (strip Windows CRLF if present)
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r//' /entrypoint.sh && chmod +x /entrypoint.sh

# Change ownership of the app directory to the non-root user
RUN chown -R hospyn:hospyn /app /entrypoint.sh

# Switch to non-root user
USER hospyn

# Cloud Run requires listening on $PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
