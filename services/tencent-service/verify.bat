@echo off
cd /d C:\Projects\AlphaTerminal\services\tencent-service
set PYTHONPATH=C:\Projects\AlphaTerminal\services\tencent-service

echo === STEP 1: Install system-wide deps ===
pip install fastapi uvicorn requests pytest -q 2>&1

echo.
echo === STEP 2: Python tests ===
python -m pytest tests -v 2>&1

echo.
echo === STEP 3: Start FastAPI ===
start /B python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
ping -n 3 127.0.0.1 >nul

echo.
echo === STEP 4: GET /health ===
curl -s http://127.0.0.1:8001/health

echo.
echo.
echo === STEP 5: GET /quotes ===
curl -s "http://127.0.0.1:8001/quotes?codes=002896,000988"

echo.
echo === DONE ===