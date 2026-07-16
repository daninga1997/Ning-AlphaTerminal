import subprocess, sys, os
venv_dir = os.path.join(os.path.dirname(__file__), '.venv')
if not os.path.exists(venv_dir):
    subprocess.run([sys.executable, '-m', 'venv', venv_dir], check=True)
pip = os.path.join(venv_dir, 'Scripts', 'pip.exe')
subprocess.run([pip, 'install', 'pytest', 'requests', 'fastapi', 'uvicorn'], check=True)
print("VENV READY")