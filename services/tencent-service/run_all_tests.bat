@echo off
set PYTHONPATH=C:\Projects\AlphaTerminal\services\tencent-service
cd /d C:\Projects\AlphaTerminal\services\tencent-service

echo Installing deps...
pip install fastapi uvicorn requests pytest -q 2>&1

echo.
echo === Python Tests ===
python -m pytest tests -v 2>&1

echo.
echo === TypeScript Tests ===
cd /d C:\Projects\AlphaTerminal
C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe node_modules\vitest\vitest.mjs run 2>&1

echo.
echo ALL TESTS DONE