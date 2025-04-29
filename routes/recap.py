import os
import json
from fastapi import APIRouter, Query
from models import Station, Prix
from datetime import datetime, timedelta, timezone
from fastapi.responses import JSONResponse
from collections import defaultdict
from db import SessionLocal
import logger

router = APIRouter()


DATA_DIR = "static/recap"

def calculate_zones():
    task = logger.log_info_start("Calculating new data",
                                 f"Calculating data recap\n\nAutomatic update {datetime.now(timezone.utc).strftime('%I%p').lower()}")
    db : SessionLocal = SessionLocal()
    try:
        os.makedirs(DATA_DIR, exist_ok=True)

        fuels = ['SP95', 'SP98', 'E10', 'E85', 'GAZOLE', 'GPLC']
        today = datetime.now(timezone.utc).date()
        days = [today - timedelta(days=i) for i in reversed(range(7))]

        for fuel in fuels:
            recap = defaultdict(lambda: {
                "station_count": 0,
                "cheapest_ville": None,
                "avg_price": [],
                "min_price": [],
                "max_price": [],
                "date": [],
                "history": {}
            })

            stations = db.query(Station).all()
            stations_by_id = {s.id: s for s in stations}

            prices = db.query(Prix).filter(Prix.carburant == fuel).all()

            prices_by_day = defaultdict(list)
            for price in prices:
                if price.date_maj:
                    day = price.date_maj.date()
                    if day in days:
                        prices_by_day[day].append(price)

            all_region_keys = set()
            all_departement_keys = set()

            for day in days:
                day_prices = prices_by_day.get(day, [])

                all_prices = []
                min_station = None
                max_station = None

                regions = defaultdict(list)
                departements = defaultdict(list)

                for p in day_prices:
                    station = stations_by_id.get(p.station_id)
                    if not station:
                        continue

                    info = {
                        "station": station,
                        "prix": p.valeur
                    }

                    all_prices.append(info)
                    regions[station.region].append(info)
                    departements[station.departement].append(info)

                def update_zone(zone_name, group):
                    prices = [g["prix"] for g in group]
                    if not prices:
                        return

                    recap[zone_name]["station_count"] = len(set(g["station"].id for g in group))
                    min_info = min(group, key=lambda g: g["prix"])
                    max_info = max(group, key=lambda g: g["prix"])

                    if day == today:
                        recap[zone_name]["cheapest_ville"] = min_info["station"].ville

                    recap[zone_name]["avg_price"].append(round(sum(prices) / len(prices), 3))
                    recap[zone_name]["min_price"].append(round(min(prices), 3))
                    recap[zone_name]["max_price"].append(round(max(prices), 3))
                    recap[zone_name]["date"].append(str(day))

                    recap[zone_name]["history"][str(day)] = {
                        "min": {
                            "adresse": min_info["station"].adresse,
                            "ville": min_info["station"].ville,
                            "prix": min_info["prix"],
                            "services": min_info["station"].services
                        },
                        "max": {
                            "adresse": max_info["station"].adresse,
                            "ville": max_info["station"].ville,
                            "prix": max_info["prix"],
                            "services": max_info["station"].services
                        }
                    }

                update_zone("france", all_prices)

                for region, infos in regions.items():
                    if region:
                        update_zone(region, infos)
                        all_region_keys.add(region)

                for dept, infos in departements.items():
                    if dept:
                        update_zone(dept, infos)
                        all_departement_keys.add(dept)

            avg_region_price = []
            avg_departement_price = []

            for region in all_region_keys:
                if recap[region]["avg_price"]:
                    avg = round(sum(recap[region]["avg_price"]) / len(recap[region]["avg_price"]), 3)
                    avg_region_price.append({"nom": region, "valeur": avg})

            for dept in all_departement_keys:
                if recap[dept]["avg_price"]:
                    avg = round(sum(recap[dept]["avg_price"]) / len(recap[dept]["avg_price"]), 3)
                    avg_departement_price.append({"nom": dept, "valeur": avg})

            # Ajout au recap
            recap["avg_region_price"] = avg_region_price
            recap["avg_departement_price"] = avg_departement_price

            output_path = os.path.join(DATA_DIR, f"{fuel}.json")
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(recap, f, ensure_ascii=False, indent=2)
        task.update("Success",
                f"Calculated new data !\n\nAutomatic update {datetime.now(timezone.utc).strftime('%I%p').lower()}")
    except Exception as e:
        task.update("Failed", "Check error log for details.")
        logger.log_error(e, context="While processing data in calculate_zones()")

    finally:
        db.close()



@router.get("/recap")
async def get_recap(
    zone: str = Query(default="france"),
    fuel: str = Query(default="SP95")
):
    file_path = os.path.join(DATA_DIR, f"{fuel.upper()}.json")

    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "Fuel type not found"})

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    zone_data = data.get(zone)
    if not zone_data:
        return JSONResponse(status_code=404, content={"error": "Zone not found"})

    response = {
        "station_count": zone_data.get("station_count"),
        "cheapest_ville": zone_data.get("cheapest_ville"),
        "avg_price": zone_data.get("avg_price"),
        "min_price": zone_data.get("min_price"),
        "max_price": zone_data.get("max_price"),
        "date": zone_data.get("date"),
        "history": zone_data.get("history")
    }

    return response

@router.get("/recap/price")
async def get_recap_price(
    zone_type: str = Query(default="region"),
    fuel: str = Query(default="SP95")
) :
    file_path = os.path.join(DATA_DIR, f"{fuel.upper()}.json")

    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"error": "Fuel type not found"})

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if zone_type != "region" and zone_type != "departement":
        return JSONResponse(status_code=404, content={"error": "Zone type not found"})

    response = data.get(f"avg_{zone_type}_price")

    return response