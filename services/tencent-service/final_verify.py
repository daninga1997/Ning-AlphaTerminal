import subprocess, sys, os, json, time, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
sys.path.insert(0, ROOT)

LOG = os.path.join(ROOT, "verify_output.txt")

def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")
    print(msg)

# 1. 安装依赖
log("=== STEP 1: Installing deps ===")
subprocess.run([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn", "requests"], capture_output=True)

# 2. 运行测试（无pytest则直接用Python）
log("\n=== STEP 2: Running parser tests ===")
test_script = os.path.join(ROOT, "tests", "test_quote_parser.py")
subprocess.run([sys.executable, test_script])

# 3. 启动服务
log("\n=== STEP 3: Starting FastAPI ===")
proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8010"], cwd=ROOT)
time.sleep(3)

# 4. health
log("\n=== STEP 4: GET /health ===")
try:
    r = urllib.request.urlopen("http://127.0.0.1:8010/health", timeout=5)
    log(r.read().decode())
except Exception as e:
    log(f"ERROR: {e}")

# 5. quotes
log("\n=== STEP 5: GET /quotes ===")
try:
    r = urllib.request.urlopen("http://127.0.0.1:8010/quotes?codes=002896,000988", timeout=20)
    data = json.loads(r.read())
    log(json.dumps(data, indent=2, ensure_ascii=False))
    if data.get("success"):
        for q in data["data"]:
            log(f"\n  {q['code']} {q['name']}:")
            log(f"    price={q['price']} change={q['change']} changePercent={q['changePercent']}")
            log(f"    volume={q['volume']} amount={q['amount']}")
            log(f"    open={q['open']} high={q['high']} low={q['low']} previousClose={q['previousClose']}")
            log(f"    source={q['source']} status={q['status']} marketTimestamp={q.get('marketTimestamp','?')}")
            log(f"    isDemo={q.get('isDemo','?')}")
except Exception as e:
    log(f"ERROR: {e}")

proc.terminate()
log("\n=== VERIFICATION COMPLETE ===")
log("Output saved to: " + LOG)