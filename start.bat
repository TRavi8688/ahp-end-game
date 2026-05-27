@echo off
echo Starting Hospyn Local Environment...
echo.

echo Starting Docker containers (PostgreSQL, Redis, FastAPI)...
docker-compose up -d --build

echo.
echo Containers are starting in the background.
echo API will be available at: http://localhost:8000
echo.

echo Starting Frontend (Vite)...
cd super-admin-dashboard
npm run dev
