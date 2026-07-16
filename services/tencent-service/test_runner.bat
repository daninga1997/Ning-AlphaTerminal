@echo off
cd /d C:\Projects\AlphaTerminal\services\tencent-service
set PYTHONPATH=C:\Projects\AlphaTerminal\services\tencent-service
.venv\Scripts\python.exe -m pytest tests -v