# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd app; uvicorn main:app --reload --port 8000"

# Start Staff Portal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd staff-portal; npm run dev -- --port 5173"

# Start Doctor App
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd doctor-app; npm run dev -- --port 5174"

# Start Partner App
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd partner-app; npm run dev -- --port 5175"

# Start Patient App
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd patient-app; npm start"
