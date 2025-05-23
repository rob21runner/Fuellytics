from fastapi import FastAPI, Depends
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from apscheduler.schedulers.background import BackgroundScheduler
import os

from dotenv import load_dotenv
load_dotenv(dotenv_path="./.env")

from routes import stations, track, admin, recap
from db import Base, engine, SessionLocal
from fetch_data import fetch_and_store
from logger import log_status, log_info_start, log_error

Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await log_status(True)
    yield
    await log_status(False)

app = FastAPI(lifespan=lifespan)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(stations.router)
app.include_router(track.router)
app.include_router(admin.router)
app.include_router(recap.router)

favicon_path = 'favicon.ico'

@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    return FileResponse(favicon_path)

@app.get("/", response_class=HTMLResponse)
def root():
    with open("templates/index.html", encoding="utf-8") as f:
        return f.read()

@app.get("/overview", response_class=HTMLResponse)
def overview():
    with open("templates/overview.html", encoding="utf-8") as f:
        return f.read()

@app.get("/about", response_class=HTMLResponse)
def about():
    with open("templates/about.html", encoding="utf-8") as f:
        return f.read()

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(
    _: str = Depends(admin.check_admin)
):
    with open("templates/admin.html", encoding="utf-8") as f:
        return f.read()

scheduler = BackgroundScheduler()
scheduler.add_job(fetch_and_store, 'cron', hour='0, 4, 8, 12, 16, 20', minute=15)
scheduler.start()

if not os.path.exists("static/recap"):
    task = log_info_start("Initial data fetch", "The folder recap does not exist. Fetching new data.")
    try:
        fetch_and_store()
        task.update("Success", "Folder created and fetched new data from the API.")
    except Exception as e:
        task.update("Failed", "Check error log for details.")
        log_error(e, context="While processing data.")


if __name__ == "__main__":

    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8010)