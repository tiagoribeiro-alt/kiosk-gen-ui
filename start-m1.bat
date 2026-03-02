@echo off
echo Starting Kiosk Gen-UI M1

start cmd /k "cd backend && call venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"
start cmd /k "cd frontend && npm run dev"

echo Backend and Frontend are starting in separate windows.
