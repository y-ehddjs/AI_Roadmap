from fastapi import FastAPI

app = FastAPI(title="goal-roadmap-app backend")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
