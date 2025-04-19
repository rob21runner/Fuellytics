from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db import get_db
import models

router = APIRouter(prefix="/stations", tags=["stations"])

@router.get("/")
def get_stations(
    x_min: float = Query(...),
    y_min: float = Query(...),
    x_max: float = Query(...),
    y_max: float = Query(...),
    fuel: str = Query(...),
    db: Session = Depends(get_db)
):
    print(x_min)
    stations = db.query(models.Station).filter(
        models.Station.longitude.between(x_min, x_max),
        models.Station.latitude.between(y_min, y_max)
    ).all()

    result = []
    for station in stations:
        prix = db.query(models.Prix).filter(
            models.Prix.station_id == station.id,
            models.Prix.carburant == fuel.upper()
        ).order_by(models.Prix.date_maj.desc()).first()

        if prix:
            result.append({
                "id": station.id,
                "latitude": station.latitude,
                "longitude": station.longitude,
                "prix": prix.valeur
            })

    return result


@router.get("/{station_id}/history")
def station_history(station_id: int, db: Session = Depends(get_db)):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}

    carburants = ["SP95", "SP98", "E10", "E85", "Gazole", "GPLc"]

    prix_actuels = {}
    history = {}

    for carburant in carburants:
        prix_history = db.query(models.Prix).filter(
            models.Prix.station_id == station_id,
            models.Prix.carburant == carburant.upper()
        ).order_by(models.Prix.date_maj).all()

        if prix_history:
            history[carburant] = [{"date": p.date_maj.date(), "valeur": p.valeur} for p in prix_history]
            prix_actuels[carburant] = prix_history[-1].valeur  # Dernier prix connu

    response = {
        "station": {
            "id": station.id,
            "ville": station.ville,
            "adresse": station.adresse,
            "services": station.services,
            "carburants": list(prix_actuels.keys()),
            "prix_actuels": prix_actuels
        },
        "history": history
    }

    return response