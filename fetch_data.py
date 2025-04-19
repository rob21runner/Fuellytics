import requests
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from db import SessionLocal
import logger
import models

URL = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/geojson?limit=10000"

def fetch_and_store():
    task = logger.log_info_start("Fetching new data",f"Fetching data from {URL}\n\nAutomatic update {datetime.now(timezone.utc).strftime('%I%p').lower()}")
    db: Session = SessionLocal()
    try:
        response = requests.get(URL)
        data = response.json()
        now = datetime.now(timezone.utc)

        db.query(models.Prix).filter(
            models.Prix.releve_timestamp < now - timedelta(days=7)
        ).delete(synchronize_session=False)

        db.query(models.Rupture).filter(
            models.Rupture.debut < now - timedelta(days=365)
        ).delete(synchronize_session=False)

        for feature in data["features"]:
            props = feature["properties"]

            station = models.Station(
                id=props["id"],
                latitude=feature["geometry"]["coordinates"][1],
                longitude=feature["geometry"]["coordinates"][0],
                cp=props["cp"],
                ville=props["ville"],
                adresse=props["adresse"],
                services=props.get("services"),
                horaires=props.get("horaires"),
                automate_24_24=props.get("horaires_automate_24_24") == "Oui",
                departement=props["departement"],
                region=props["region"]
            )

            db.merge(station)

            prix_list = []
            carburants = ["gazole", "sp95", "e85", "gplc", "e10", "sp98"]

            for carburant in carburants:
                valeur = props.get(f"{carburant}_prix")
                maj = props.get(f"{carburant}_maj")

                if valeur is not None and maj is not None:
                    prix_list.append({
                        "@nom": carburant.upper(),
                        "@valeur": valeur,
                        "@maj": maj
                    })

            for p in prix_list:
                existing_price = db.query(models.Prix).filter(
                    models.Prix.station_id == props["id"],
                    models.Prix.carburant == p["@nom"],
                    models.Prix.date_maj >= now.replace(hour=0, minute=0, second=0, microsecond=0)
                ).first()

                if existing_price:
                    existing_price.valeur = float(p["@valeur"])
                    existing_price.date_maj = datetime.fromisoformat(p["@maj"])
                    existing_price.releve_timestamp = now
                else:
                    prix = models.Prix(
                        station_id=props["id"],
                        carburant=p["@nom"],
                        valeur=float(p["@valeur"]),
                        date_maj=datetime.fromisoformat(p["@maj"]),
                        releve_timestamp=now
                    )
                    db.add(prix)

            for carburant in carburants:
                debut_key = f"{carburant}_rupture_debut"
                type_key = f"{carburant}_rupture_type"

                debut = props.get(debut_key)
                type_ = props.get(type_key)

                if debut and type_:
                    rupture = models.Rupture(
                        station_id=props["id"],
                        carburant=carburant.upper(),
                        debut=datetime.fromisoformat(debut),
                        fin=None,
                        type=type_
                    )
                    db.add(rupture)

        db.commit()
        task.update("Success",f"Fetched new data from {URL}\n\nAutomatic update {datetime.now(timezone.utc).strftime('%I%p').lower()}")
    except Exception as e:
        task.update("Failed", "Check error log for details.")
        logger.log_error(e, context="While processing data in fetch_and_store()")
    finally:
        db.close()

if __name__ == "__main__":
    fetch_and_store()
