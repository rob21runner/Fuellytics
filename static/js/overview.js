trackPageView("overview");

let sessionStart = Date.now();

window.addEventListener("beforeunload", () => {
  const duration = Date.now() - sessionStart;
  const payload = {
    type: "leave",
    page: "overview",
    data: { durationMs: duration },
    userId: localStorage.getItem("userId")
  };

  navigator.sendBeacon(`${API_BASE_URL}/track`, new Blob([JSON.stringify(payload)], {
    type: "application/json"
  }));
});

// PAS TOUCHER PARTIE AU DESSUS OMFG
let fuelType = localStorage.getItem('preferredFuel') || 'SP95';
const fuelSelect = document.getElementById("fuelSelect");

if (fuelSelect) {
    fuelSelect.value = fuelType
    fuelSelect.addEventListener("change", () => {
        fuelType = fuelSelect.value;
        trackEvent("fuelChange", { fuel: fuelType });
        localStorage.setItem('preferredFuel', fuelType);
        const msg = document.getElementById("fuelMessage");
        if (msg) {
            msg.style.display = "inline";
            setTimeout(() => msg.style.display = "none", 1500);
        }
        stationsCache.forEach(marker => map.removeLayer(marker));
        stationsCache.clear();
        lastFetchedBounds = null;
        fetchStations();
    });
}

let currentFuel = fuelType;
let currentMode = 'region';
let geojsonLayer = null;
let priceData = {};
let map = null;

let globalMinPrice = null;
let globalMaxPrice = null;

const serviceIcons = {
    "Aire de camping-cars": "fa-caravan",
    "Automate CB 24/24": "fa-credit-card",
    "Bar": "fa-mug-hot",
    "Bornes électriques": "fa-bolt",
    "Boutique alimentaire": "fa-apple-alt",
    "Boutique non alimentaire": "fa-store",
    "Carburant additivé": "fa-vial",
    "DAB (Distributeur automatique de billets)": "fa-money-bill-alt",
    "Douches": "fa-shower",
    "Espace bébé": "fa-baby",
    "GNV": "fa-gas-pump",
    "Lavage automatique": "fa-car-side",
    "Lavage manuel": "fa-hands-wash",
    "Laverie": "fa-soap",
    "Location de véhicule": "fa-car",
    "Piste poids lourds": "fa-truck",
    "Relais colis": "fa-box-open",
    "Restauration sur place": "fa-utensils",
    "Restauration à emporter": "fa-hamburger",
    "Services réparation / entretien": "fa-tools",
    "Station de gonflage": "fa-wind",
    "Toilettes publiques": "fa-restroom",
    "Vente d'additifs carburants": "fa-vial",
    "Vente de fioul domestique": "fa-fire",
    "Vente de gaz domestique (Butane, Propane)": "fa-gas-pump",
    "Vente de pétrole lampant": "fa-flask",
    "Wifi": "fa-wifi"
};

async function start() {
  await loadAllPrices(currentMode, currentFuel);
  renderRegionDepartementMap();
}

async function reloadData() {
  if (geojsonLayer) {
    geojsonLayer.remove();
  }
  await loadAllPrices(currentMode, currentFuel);
  renderRegionDepartementMap();
}

function renderRegionDepartementMap() {
  if (!map) {
    map = L.map('statMap', {
      center: [46.5, 2.5],
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
      maxBounds: [[41, -5], [51.5, 10]],
      maxBoundsViscosity: 1.0
    }).setView([46.5, 2.5], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);
  }

  function loadGeoJSON(mode) {
    const url = mode === 'region' ? '/static/regions.geojson' : '/static/departements.geojson';

    fetch(url)
      .then(res => res.json())
      .then(geojson => {
        geojsonLayer = L.geoJSON(geojson, {
          style: feature => {
            const zoneName = feature.properties.nom;
            const avgPrice = priceData[zoneName];
            const normalizedPrice = avgPrice ?? 0;

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
              mouseover: e => {
                const layer = e.target;
                layer.setStyle({
                  weight: 2,
                  color: '#000',
                  fillOpacity: 0.8
                });
              },
              mouseout: e => {
                geojsonLayer.resetStyle(e.target);
              },
              click: () => {
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

function getColor(price) {
  if (globalMinPrice == null || globalMaxPrice == null || globalMinPrice === globalMaxPrice) {
    return '#888';
  }

  const ratio = Math.min(Math.max((price - globalMinPrice) / (globalMaxPrice - globalMinPrice), 0), 1);

  let r, g;
  if (ratio < 0.5) {
    r = Math.floor(255 * (ratio * 2));
    g = 255;
  } else {
    r = 255;
    g = Math.floor(255 * (1 - (ratio - 0.5) * 2));
  }

  return `rgb(${r},${g},0)`;
}

async function loadAllPrices(mode, fuel) {
  priceData = {};
  globalMinPrice = null;
  globalMaxPrice = null;

  const url = mode === 'region' ? '/static/regions.geojson' : '/static/departements.geojson';
  const geojson = await fetch(url).then(res => res.json());

  const prices = [];
  let totalStations = 0;
  let cheapestVille = null;
  let cheapestPrice = Infinity;
  let avgPrice = 0;

  const fuelFile = `/static/recap/${fuel}.json`;
  let allData = {};
  try {
    const response = await fetch(fuelFile);
    if (!response.ok) {
      console.warn(`Fichier ${fuel}.json introuvable`);
      return;
    }
    allData = await response.json();
  } catch (err) {
    console.error(`Erreur en chargeant ${fuelFile}`, err);
    return;
  }

  for (const feature of geojson.features) {
    const zoneName = feature.properties.nom;
    const zoneData = allData[zoneName];
    if (zoneData && zoneData.avg_price?.length > 0) {
      const lastPrice = zoneData.avg_price.at(-1);
      priceData[zoneName] = lastPrice;
      prices.push(lastPrice);
      totalStations += zoneData.station_count;
      avgPrice += lastPrice;

      if (lastPrice < cheapestPrice) {
        cheapestPrice = lastPrice;
        cheapestVille = zoneData.cheapest_ville;
      }
    }
  }

  if (prices.length > 0) {
    globalMinPrice = Math.min(...prices);
    globalMaxPrice = Math.max(...prices);
    console.log(`Min = ${globalMinPrice}, Max = ${globalMaxPrice} pour le carburant ${fuel}`);
  } else {
    globalMinPrice = 1.0;
    globalMaxPrice = 2.0;
  }

  avgPrice /= prices.length;

  document.getElementById('stat-stations').innerText = totalStations;
  document.getElementById('stat-avg-price').innerText = avgPrice.toFixed(2);
  document.getElementById('stat-economic').innerText = cheapestVille ?? 'N/A';

  // Station la moins chère (France entière)
  if (cheapestPrice !== Infinity && cheapestVille) {
    let cheapestStation = null;

    for (const zoneName in allData) {
      const zone = allData[zoneName];
      const lastDate = Object.keys(zone.history).at(-1);
      if (zone?.history?.[lastDate]?.min?.prix === cheapestPrice) {
        cheapestStation = zone.history[lastDate].min;
        break;
      }
    }

    if (cheapestStation) {
      let servicesHtml = '';
      try {
        const parsed = JSON.parse(cheapestStation.services);
        if (parsed.service && Array.isArray(parsed.service)) {
          servicesHtml = parsed.service.map(s => {
            const icon = serviceIcons[s];
            const safeLabel = s.replace(/"/g, '&quot;');
            return icon
              ? `<div class="service-icon tooltip" title="${safeLabel}" data-label="${safeLabel}">
                      <i class="fas ${icon}"></i>
                      <div class="tooltiptext">${safeLabel}</div>
                 </div>`
              : '';
          }).join('');
        }
      } catch (e) {}

      document.getElementById('moins').innerHTML = `
          <div class="box-title">Station la moins chère (France)</div>
          <div>Adresse: ${cheapestStation.adresse}</div>
          <div>Ville: ${cheapestStation.ville}</div>
          <div>Prix: ${cheapestStation.prix} €/L</div>
          <div class="cat-header">🏪 Services</div>
          <div class="station-services">${servicesHtml}</div>
      `;
    }
  }

  // Station la plus chère (France entière)
  let mostExpensivePrice = -Infinity;
  let mostExpensiveStation = null;

  for (const zoneName in allData) {
    const zone = allData[zoneName];
    const lastDate = Object.keys(zone.history).at(-1);
    const maxStation = zone.history?.[lastDate]?.max;
    if (maxStation?.prix > mostExpensivePrice) {
      mostExpensivePrice = maxStation.prix;
      mostExpensiveStation = maxStation;
    }
  }

  if (mostExpensiveStation) {
    let servicesHtml = '';
    try {
      const parsed = JSON.parse(mostExpensiveStation.services);
      if (parsed.service && Array.isArray(parsed.service)) {
        servicesHtml = parsed.service.map(s => {
          const icon = serviceIcons[s];
          const safeLabel = s.replace(/"/g, '&quot;');
          return icon
            ? `<div class="service-icon tooltip" title="${safeLabel}" data-label="${safeLabel}">
                    <i class="fas ${icon}"></i>
                    <div class="tooltiptext">${safeLabel}</div>
               </div>`
            : '';
        }).join('');
      }
    } catch (e) {}

    document.getElementById('plus').innerHTML = `
        <div class="box-title">Station la plus chère (France)</div>
        <div>Adresse: ${mostExpensiveStation.adresse}</div>
        <div>Ville: ${mostExpensiveStation.ville}</div>
        <div>Prix: ${mostExpensiveStation.prix} €/L</div>
        <div class="cat-header">🏪 Services</div>
        <div class="station-services">${servicesHtml}</div>
    `;
  }
}

function fetchRecapData(zoneName) {
  const url = `/recap?zone=${encodeURIComponent(zoneName)}&fuel=${currentFuel}`;

  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Erreur API");
      return response.json();
    })
    .then(data => {
      const stationCount = data.station_count || 0;
      const avgPrice = data.avg_price?.at(-1) || 0;
      const cheapestCity = data.cheapest_ville || "Inconnu";
      const cheapestPrice = data.min_price?.at(-1) || 0;

      document.getElementById('stat-stations').innerText = stationCount;
      document.getElementById('stat-avg-price').innerText = avgPrice.toFixed(3);
      document.getElementById('stat-economic').innerText = `${cheapestCity}`;
      document.getElementById('selectedZoneTitle').innerText = zoneName;

      updatePricePlot(data);
      displayStationsForDate(data.history, data.date.at(-1));

      document.getElementById('pricePlot').on('plotly_click', function (dataClick) {
        const clickedDate = dataClick.points[0].x;
        displayStationsForDate(window.lastHistoryData, clickedDate);
      });

      window.lastHistoryData = data.history;
    })
    .catch(error => {
      console.error('Erreur fetchRecapData', error);
      document.getElementById('priceInfo').innerText = "Données indisponibles.";
    });
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
  const mostExpensiveStation = history[date].max;

  moinsDiv.innerHTML = `
    <div class="box-title">Station la moins chère</div>
    <div>Adresse: ${cheapestStation.adresse}</div>
    <div>Ville: ${cheapestStation.ville}</div>
    <div>Prix: ${cheapestStation.prix} €/L</div>
    <div>Services: ${generateServicesHtml(cheapestStation.services)}</div>
  `;

  if (mostExpensiveStation) {
    plusDiv.innerHTML = `
      <div class="box-title">Station la plus chère</div>
      <div>Adresse: ${mostExpensiveStation.adresse}</div>
      <div>Ville: ${mostExpensiveStation.ville}</div>
      <div>Prix: ${mostExpensiveStation.prix} €/L</div>
      <div>Services: ${generateServicesHtml(mostExpensiveStation.services)}</div>
    `;
  } else {
    plusDiv.innerHTML = "<div>Aucune station disponible.</div>";
  }
}

function generateServicesHtml(servicesJson) {
  let servicesHtml = '';
  try {
    const parsed = JSON.parse(servicesJson);
    if (parsed.service && Array.isArray(parsed.service)) {
      servicesHtml = parsed.service.map(service => {
        const icon = serviceIcons[service];
        const safeLabel = service.replace(/"/g, '&quot;');
        return icon
          ? `<div class="service-icon tooltip" title="${safeLabel}" data-label="${safeLabel}">
              <i class="fas ${icon}"></i>
              <div class="tooltiptext">${safeLabel}</div>
            </div>`
          : '';
      }).join('');
    }
  } catch (e) {
    console.error('Erreur de parsing des services:', e);
  }
  return servicesHtml;
}

function updatePricePlot(data) {
  const dates = data.date;
  const minPrices = data.min_price;
  const avgPrices = data.avg_price;
  const maxPrices = data.max_price;

  const dataPlot = [
    {
      x: dates,
      y: minPrices,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Prix Minimum',
      line: { color: 'green' },
      marker: { color: 'green' }
    },
    {
      x: dates,
      y: avgPrices,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Prix Moyen',
      line: { color: 'blue' },
      marker: { color: 'blue' }
    },
    {
      x: dates,
      y: maxPrices,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Prix Maximum',
      line: { color: 'red' },
      marker: { color: 'red' }
    }
  ];

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

  Plotly.newPlot('pricePlot', dataPlot, layout, { responsive: true });
}

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

start();
