// =======================
// Variables Globales
// =======================
let currentFuel = 'SP95';
let currentMode = 'region';
let geojsonLayer = null;
let priceData = {};
let map = null;

let globalMinPrice = null;
let globalMaxPrice = null;

// =======================
// Initialisation
// =======================
async function start() {
    await loadAllPrices(currentMode, currentFuel);
    renderRegionDepartementMap();
}

async function reloadData() {
    if (!map) {
        await loadAllPrices(currentMode, currentFuel);
        renderRegionDepartementMap();
    } else {
        if (geojsonLayer) {
            geojsonLayer.remove();
        }
        await loadAllPrices(currentMode, currentFuel);
        renderRegionDepartementMap();
    }
}

// =======================
// Fonctions
// =======================
function getColor(price) {
    if (globalMinPrice == null || globalMaxPrice == null || globalMinPrice === globalMaxPrice) {
        return '#888'; // couleur grise si pas de données valides
    }

    const ratio = Math.min(Math.max((price - globalMinPrice) / (globalMaxPrice - globalMinPrice), 0), 1);

    let r, g;
    if (ratio < 0.5) {
        r = Math.floor(255 * (ratio * 2)); // de 0 à 255
        g = 255;
    } else {
        r = 255;
        g = Math.floor(255 * (1 - (ratio - 0.5) * 2)); // de 255 à 0
    }

    return `rgb(${r},${g},0)`;
}

function renderRegionDepartementMap() {
    if (!map) {
        map = L.map('statMap', {
            center: [46.5, 2.5],
            zoom: 5,
            zoomControl: false,
            scrollWheelZoom: false,
            attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }

    function loadGeoJSON(mode) {
        const url = mode === 'region' ? '/static/regions.geojson' : '/static/departements.geojson';

        fetch(url)
            .then(res => res.json())
            .then(geojson => {
                if (geojsonLayer) {
                    map.removeLayer(geojsonLayer);
                }

                geojsonLayer = L.geoJSON(geojson, {
                    style: feature => {
                        const zoneName = feature.properties.nom;
                        const avgPrice = priceData[zoneName];

                        let normalizedPrice = avgPrice ?? 0; // sécurité si avgPrice est null

                        return {
                            fillColor: getColor(normalizedPrice),
                            weight: 1,
                            color: '#444',
                            fillOpacity: 0.6
                        };
                    },
                    onEachFeature: (feature, layer) => {
                        const zoneName = feature.properties.nom;
                        layer.bindTooltip(zoneName, { sticky: true });

                        layer.on({
                            mouseover: (e) => {
                                const layer = e.target;
                                layer.setStyle({
                                    weight: 2,
                                    color: '#000',
                                    fillOpacity: 0.8
                                });
                            },
                            mouseout: (e) => {
                                geojsonLayer.resetStyle(e.target);
                            },
                            click: (e) => {
                                fetchRecapData(zoneName);
                            }
                        });
                    }
                }).addTo(map);
            })
            .catch(error => {
                console.error("Erreur chargement GeoJSON", error);
            });
    }

    loadGeoJSON(currentMode);
}

async function loadAllPrices(mode, fuel) {
    priceData = {}; // Reset
    globalMinPrice = null;
    globalMaxPrice = null;

    const url = mode === 'region' ? '/static/regions.geojson' : '/static/departements.geojson';
    const geojson = await fetch(url).then(res => res.json());

    let prices = [];
    let totalStations = 0;
    let cheapestVille = null;
    let cheapestPrice = Infinity;
    let avgPrice = 0;

    for (const feature of geojson.features) {
        const zoneName = feature.properties.nom;
        try {
            // Charger le fichier JSON correspondant au carburant (ex: recap/SP95.json)
            const fuelFile = `/static/recap/${fuel}.json`;
            const response = await fetch(fuelFile);
            if (!response.ok) {
                console.warn(`Fichier ${fuel}.json introuvable pour la zone ${zoneName}`);
                continue;
            }

            const data = await response.json();
            const zoneData = data[zoneName];

            if (zoneData && zoneData.avg_price && zoneData.avg_price.length > 0) {
                const lastPrice = zoneData.avg_price[zoneData.avg_price.length - 1];
                priceData[zoneName] = lastPrice;
                prices.push(lastPrice);

                // Mise à jour du total de stations, prix moyen et ville la moins chère
                totalStations += zoneData.station_count;
                avgPrice += lastPrice;

                if (lastPrice < cheapestPrice) {
                    cheapestPrice = lastPrice;
                    cheapestVille = zoneData.cheapest_ville;
                }
            }
        } catch (error) {
            console.error("Erreur en chargeant les prix pour", zoneName, error);
        }
    }

    if (prices.length > 0) {
        globalMinPrice = Math.min(...prices);
        globalMaxPrice = Math.max(...prices);
        console.log(`Min = ${globalMinPrice}, Max = ${globalMaxPrice} pour le carburant ${fuel}`);
    } else {
        // fallback
        globalMinPrice = 1.0;
        globalMaxPrice = 2.0;
    }

    // Calcul du prix moyen
    avgPrice = avgPrice / prices.length;

    // Mettre à jour le résumé sur la page
    document.getElementById('stat-stations').innerText = totalStations;
    document.getElementById('stat-avg-price').innerText = avgPrice.toFixed(2);
    document.getElementById('stat-economic').innerText = cheapestVille ?? 'N/A';
}

// Fonction mise à jour pour récupérer les données et remplir les statistiques
function fetchRecapData(zoneName) {
    const url = `/recap?zone=${encodeURIComponent(zoneName)}&fuel=${currentFuel}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error("Erreur API");
            return response.json();
        })
        .then(data => {
            // Mettre à jour les statistiques dans le DOM
            const stationCount = data.station_count || 0;
            const avgPrice = data.avg_price ? data.avg_price[data.avg_price.length - 1] : 0; // Dernier prix moyen
            const cheapestCity = data.cheapest_ville || "Inconnu"; // Ville la moins chère
            const cheapestPrice = data.min_price ? data.min_price[data.min_price.length - 1] : 0; // Dernier prix minimum

            document.getElementById('stat-stations').innerText = stationCount;
            document.getElementById('stat-avg-price').innerText = avgPrice.toFixed(3);
            document.getElementById('stat-economic').innerText = `${cheapestCity} (${cheapestPrice.toFixed(3)} €/L)`;  // Ville et prix

            // Afficher la station la moins chère avec son prix
            //displayCheapestStation(data.history);  // Affiche les stations la moins chère
            document.getElementById('selectedZoneTitle').innerText = zoneName;
            updatePricePlot(data);  // On passe directement 'data' et plus 'data.history'
            displayStationsForDate(data.history, data.date[data.date.length - 1]);
            document.getElementById('pricePlot').on('plotly_click', function(dataClick){
            const point = dataClick.points[0];
            const clickedDate = point.x;

            console.log('Clicked on date:', clickedDate);

            // Mettre à jour les stations affichées pour la date cliquée
            displayStationsForDate(window.lastHistoryData, clickedDate);
            });
            window.lastHistoryData = data.history;  // On stocke pour accès global
        })
        .catch(error => {
            console.error('Erreur fetchRecapData', error);
            document.getElementById('priceInfo').innerText = "Données indisponibles.";
        });

}

// Fonction pour afficher les stations la moins chère
function displayCheapestStation(history) {
    const moinsDiv = document.getElementById('moins');
    moinsDiv.innerHTML = '';  // Effacer les précédents résultats

    const historyKeys = Object.keys(history);
    if (historyKeys.length > 0) {
        const lastDate = historyKeys[historyKeys.length - 1];
        const cheapestStation = history[lastDate].min;  // Station la moins chère du jour
        const { adresse, ville, prix, services } = cheapestStation;

        moinsDiv.innerHTML = `
            <div class="box-title">Station la moins chère</div>
            <div>Adresse: ${adresse}</div>
            <div>Ville: ${ville}</div>
            <div>Prix: ${prix} €/L</div>
            <div>Services: ${services}</div>
        `;
    } else {
        moinsDiv.innerHTML = "<div>Aucune station disponible.</div>";
    }
}

function updatePricePlot(data) {
    const dates = data.date;
    const minPrices = data.min_price;
    const avgPrices = data.avg_price;
    const maxPrices = data.max_price;

    const minTrace = {
        x: dates,
        y: minPrices,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Prix Minimum',
        line: { color: 'green' },
        marker: { color: 'green' }
    };

    const avgTrace = {
        x: dates,
        y: avgPrices,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Prix Moyen',
        line: { color: 'blue' },
        marker: { color: 'blue' }
    };

    const maxTrace = {
        x: dates,
        y: maxPrices,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Prix Maximum',
        line: { color: 'red' },
        marker: { color: 'red' }
    };

    const dataPlot = [minTrace, avgTrace, maxTrace];

    const layout = {
        title: 'Évolution des prix sur les 7 derniers jours',
        xaxis: {
            title: 'Date',
            type: 'category'
        },
        yaxis: {
            title: 'Prix en €/L'
        },
        legend: {
            orientation: "h",
            y: -0.2
        },
        margin: {
            t: 40,
            l: 50,
            r: 30,
            b: 80
        },
        plot_bgcolor: '#fff',
        paper_bgcolor: '#fff'
    };

    Plotly.newPlot('pricePlot', dataPlot, layout, {responsive: true});
}

function displayStationsForDate(history, date) {
    const moinsDiv = document.getElementById('moins');
    const plusDiv = document.getElementById('plus');

    if (!history[date]) {
        moinsDiv.innerHTML = "<div>Pas de données disponibles pour cette date.</div>";
        plusDiv.innerHTML = "<div>Pas de données disponibles pour cette date.</div>";
        return;
    }

    const cheapestStation = history[date].min;
    const mostExpensiveStation = history[date].max;  // On va chercher max_station dans history

    moinsDiv.innerHTML = `
        <div class="box-title">Station la moins chère</div>
        <div>Adresse: ${cheapestStation.adresse}</div>
        <div>Ville: ${cheapestStation.ville}</div>
        <div>Prix: ${cheapestStation.prix} €/L</div>
        <div>Services: ${cheapestStation.services}</div>
    `;

    if (mostExpensiveStation) {
        plusDiv.innerHTML = `
            <div class="box-title">Station la plus chère</div>
            <div>Adresse: ${mostExpensiveStation.adresse}</div>
            <div>Ville: ${mostExpensiveStation.ville}</div>
            <div>Prix: ${mostExpensiveStation.prix} €/L</div>
            <div>Services: ${mostExpensiveStation.services}</div>
        `;
    } else {
        plusDiv.innerHTML = "<div>Aucune station disponible.</div>";
    }
}



// =======================
// Gestion des événements
// =======================

document.getElementById('fuelSelect').addEventListener('change', async (e) => {
    currentFuel = e.target.value;
    await reloadData();
});

document.getElementById('regionButton').addEventListener('click', async () => {
    currentMode = 'region';
    await reloadData();
});

document.getElementById('departementButton').addEventListener('click', async () => {
    currentMode = 'departement';
    await reloadData();
});

// Lancer au démarrage
start();
