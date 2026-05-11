#!/bin/bash
set -e

# Default to API if not specified
SERVICE_TYPE=${SERVICE_TYPE:-api}
PORT=${PORT:-8080}

if [ "$SERVICE_TYPE" = "worker" ]; then
    echo "🚀 Starting Hospyn Arq Worker..."
    exec python start_worker.py
else
    # FORCING FULL PRODUCTION BOOT
    # Minimal diagnostic mode decommissioned to prevent accidental JSON bypass.
    echo "🛡️ BOOTING Hospyn v2.0.1-STABLE..."
    echo "🌐 Starting Hospyn API on port $PORT..."
    # Explicitly trusting all proxies for Railway compatibility
    exec uvicorn app.main:app --host "0.0.0.0" --port "$PORT" --log-level info --workers 1 --loop asyncio --timeout-keep-alive 75 --proxy-headers --forwarded-allow-ips="*"
fi
