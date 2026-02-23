from fastapi import FastAPI

app = FastAPI(title="CrowdLens API", version="0.1.0")

@app.get("/healthz")
def healthz():
    return {"ok": True, "service": "api"}