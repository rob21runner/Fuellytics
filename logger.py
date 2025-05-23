import traceback
import requests
import os
from datetime import datetime, timezone

INFO_WEBHOOK_URL = os.getenv("INFO_WEBHOOK_URL")
ERRORS_WEBHOOK_URL = os.getenv("ERRORS_WEBHOOK_URL")
ADMIN_WEBHOOK_URL = os.getenv("ADMIN_WEBHOOK_URL")
MAP_API_KEY = os.getenv("MAP_API_KEY")

LOG_FILE_PATH = os.path.join("logs", "local_logs.txt")

class DiscordLogTask:
    def __init__(self, message_id, edit_url, task_name):
        self.message_id = message_id
        self.edit_url = edit_url
        self.task_name = task_name

    def update(self, status: str, description: str = None):
        if INFO_WEBHOOK_URL is None:
            _log_locally(f"[{self.task_name}] Status: {status} | {description or ''}")
            return

        embed = {
            "title": f"{'✅' if status.lower() == 'success' else '❌'} {self.task_name} - {status}",
            "color": 0x2ecc71 if status.lower() == "success" else 0xe74c3c,
            "description": description or "",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        try:
            requests.patch(self.edit_url, json={"embeds": [embed]})
        except Exception as e:
            _log_locally(f"[ERROR] Failed to update Discord log: {e}\n[{self.task_name}] Status: {status} | {description or ''}")


def log_error(exc: Exception, context: str = "No context provided"):
    tb = ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    message = f"[ERROR] Context: {context}\nTraceback:\n{tb}"

    if ERRORS_WEBHOOK_URL:
        embed = {
            "title": "💥 Error Occurred",
            "color": 0xe74c3c,
            "fields": [
                {"name": "Context", "value": context[:1024], "inline": False},
                {"name": "Traceback", "value": f"```{tb[-1000:]}```", "inline": False}
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        try:
            requests.post(ERRORS_WEBHOOK_URL, json={"embeds": [embed]})
        except Exception as e:
            message += f"\n[log_error] Failed to send to Discord: {e}"
            _log_locally(message)
    else:
        _log_locally(message)


def log_info_start(task_name: str, description: str = "") -> DiscordLogTask:
    if INFO_WEBHOOK_URL is None:
        _log_locally(f"[START] {task_name} - {description}")
        return DiscordLogTask(None, None, task_name)

    embed = {
        "title": f"🚀 {task_name} - Started",
        "description": description,
        "color": 0x3498db,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        resp = requests.post(INFO_WEBHOOK_URL, json={"embeds": [embed]})
        data = resp.json()
        message_id = data["id"]
        url = INFO_WEBHOOK_URL.split("?wait")[0]
        edit_url = f"{url}/messages/{message_id}"
        return DiscordLogTask(message_id, edit_url, task_name)
    except Exception as e:
        _log_locally(f"[ERROR] Failed to start Discord log: {e}\n[START] {task_name} - {description}")
        return DiscordLogTask(None, None, task_name)


def log_admin_attempt(ip: str, count: int, authorized: bool):
    if not ADMIN_WEBHOOK_URL:
        _log_locally(f"[Admin] Tentative de {ip} x{count}")
        return

    try:
        geo_res = requests.get(f"http://ip-api.com/json/{ip}?fields=status,message,country,city,lat,lon", timeout=3)
        geo = geo_res.json()
        if geo.get("status") != "success":
            geo = {}

        location = f"{geo.get('city', 'Inconnue')}, {geo.get('country', 'Inconnu')}"
        lat, lon = geo.get("lat", 0), geo.get("lon", 0)

        # Image de carte (staticmap)
        map_url = f"https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&width=500&height=500&center=lonlat%3A{lon}%2C{lat}&zoom=5&marker=lonlat%3A{lon}%2C{lat}%3Btype%3Acircle%3Bcolor%3A%23d20000%3Bsize%3Asmall&apiKey={MAP_API_KEY}"

        payload = {
            "embeds": [{
                "title": f"🚨 Tentative d'accès à l'admin",
                "description": f"**IP :** `{ip}`\n"
                               f"**Localisation :** {location}\n"
                               f"**Tentatives :** `{count}`\n"
                               f"**Status :** `{"Authorized" if authorized else "Denied"}`\n",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "color": 0x2ecc71 if authorized else 0xe74c3c,
                "thumbnail": { "url": map_url }
            }]
        }

        requests.post(ADMIN_WEBHOOK_URL, json=payload)

    except Exception as e:
        _log_locally(f"[Webhook] Erreur : {e}")

async def log_status(starting: bool):
    if INFO_WEBHOOK_URL is None:
        _log_locally(f"[STATUS] {'Starting' if starting else 'Stopping'}")
        return

    if starting:
        description = "The Api is online, you can visit the website."
    else:
        description = "The Api is offline, if this is not intentional, please restart the server."

    embed = {
        "title": f"🔄 {'Started' if starting else 'Stopped'}",
        "description": description,
        "color": 0x2ecc71 if starting else 0xe74c3c,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    try:
        requests.post(INFO_WEBHOOK_URL, json={"embeds": [embed]})
    except Exception as e:
        _log_locally(f"[ERROR] Failed to send to Discord: {e}")


def _log_locally(text: str):
    os.makedirs("logs", exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {text}\n")