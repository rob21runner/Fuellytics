from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey, DateTime, JSON
from db import Base
from datetime import datetime, timezone

class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    cp = Column(String)
    ville = Column(String)
    adresse = Column(String)
    services = Column(String)
    horaires = Column(String)
    automate_24_24 = Column(Boolean)
    departement = Column(String)
    region = Column(String)

class Prix(Base):
    __tablename__ = "prix"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    carburant = Column(String)
    valeur = Column(Float)
    date_maj = Column(DateTime)
    releve_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Rupture(Base):
    __tablename__ = "ruptures"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    carburant = Column(String)
    debut = Column(DateTime)
    fin = Column(DateTime, nullable=True)
    type = Column(String)

class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    type = Column(String, index=True)  # ex: 'stationClick', 'fuelChange', 'search'
    page = Column(String)
    data = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))