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
let currentZoneType = 'region'; // par défaut
let currentSelectedZone = 'france'; // par défaut

async function fetchRecap(zone = 'france', fuel = 'SP95') {
  const params = new URLSearchParams({ zone, fuel });
  const res = await fetch(`${API_BASE_URL}/recap?${params}`);
  if (!res.ok) throw new Error("Erreur /recap");
  return await res.json();
}

async function fetchZonePrices(zoneType = 'region', fuel = 'SP95') {
  const params = new URLSearchParams({ zone_type: zoneType, fuel });
  const res = await fetch(`${API_BASE_URL}/recap/price?${params}`);
  if (!res.ok) throw new Error("Erreur /recap/price");
  return await res.json();
}

async function loadOverviewData() {
  try {
    const [recapData, priceZones] = await Promise.all([
      fetchRecap(currentSelectedZone, currentFuel),
      fetchZonePrices(currentZoneType, currentFuel)
    ]);
    window.globalMinPrice = Math.min(...priceZones.map(z => z.valeur));
    window.globalMaxPrice = Math.max(...priceZones.map(z => z.valeur));


    updateSummary(recapData);
    updatePriceGraph(recapData);
    updateStationDetails(recapData);
    updateMap(priceZones);

    document.getElementById("selectedZoneTitle").textContent = currentSelectedZone === "france" ? "France" : currentSelectedZone;
  } catch (err) {
    console.error(err);
  }
}

function updateSummary(data) {
  document.getElementById("stat-stations").textContent = data.station_count ?? '–';
  document.getElementById("stat-avg-price").textContent = `${(data.avg_price?.at(-1)?.toFixed(3))}€` ?? '–';
  document.getElementById("stat-economic").textContent = data.cheapest_ville ?? '–';
}

function updatePriceGraph(data) {
  if (!data || !data.date) return;

  const dates = data.date;
  const min = data.min_price;
  const avg = data.avg_price;
  const max = data.max_price;

  Plotly.newPlot("pricePlot", [
    // Max line (trace 1)
    {
      x: dates,
      y: max,
      mode: "lines",
      name: "Prix maximum",
      line: { color: "#f44336", shape: "spline" },
      fill: null
    },
    // Avg line + fill to Max (trace 2)
    {
      x: dates,
      y: avg,
      mode: "lines",
      name: "Prix moyen",
      line: { color: "#2196f3", shape: "spline" },
      fill: "tonexty",
      fillcolor: "rgba(244, 67, 54, 0.2)"
    },
    // Min line + fill to Avg (trace 3)
    {
      x: dates,
      y: min,
      mode: "lines",
      name: "Prix minimum",
      line: { color: "#4caf50", shape: "spline" },
      fill: "tonexty",
      fillcolor: "rgba(76, 175, 80, 0.2)"
    }
  ], {
    hovermode: 'x unified',
    margin: { t: 30, l: 40, r: 20, b: 40 },
    yaxis: { title: "Prix (€)", gridcolor: "#ccc", range: [0, 2.5]},
    xaxis: { title: "Date", gridcolor: "#eee" },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    legend: { x: 0, y: 1.2, orientation: "h" },
    font: { color: textColor }
  }, {
    responsive: true,
    displayModeBar: false,
    displaylogo: false
  });

  const graph = document.getElementById('pricePlot');

  graph.on('plotly_click', function(eventData) {
    const pointIndex = eventData.points[0].pointIndex;
    updateStationDetails(data, pointIndex);
  });
}

function updateStationDetails(data, day = -1) {
  const lastDate = data.date?.at(day);
  const historyToday = data.history?.[lastDate];

  if (!historyToday) return;

  // Station la moins chère
  const min = historyToday.min;
  document.getElementById("moins").innerHTML = `
    <div class="box-title"><h2>Station la moins chère</h2></div>
    <div class="param adresse">${min?.adresse ?? '–'}, ${min?.ville ?? '–'}</div>
    <div class="param">${min?.prix?.toFixed(3) ?? '–'}€</div>
    <div class="param station-services">${parseServices(min?.services)}</div>
  `;

  // Station la plus chère
  const max = historyToday.max;
  document.getElementById("plus").innerHTML = `
    <div class="box-title"><h2>Station la plus chère</h2></div>
    <div class="param adresse">${max?.adresse ?? '–'}, ${max?.ville ?? '–'}</div>
    <div class="param">${max?.prix?.toFixed(3) ?? '–'}€</div>
    <div class="param station-services">${parseServices(max?.services)}</div>
  `;
}

function parseServices(serviceStr) {
  try {
    const parsed = JSON.parse(serviceStr);
    const servicesArray = Array.isArray(parsed.service) ? parsed.service : [parsed.service];

    return servicesArray.map(s => {
      const icon = serviceIcons[s];
      const safeLabel = (s ?? '').replace(/"/g, '&quot;');
      if (!icon) return '';

      return `
        <div class="service-icon tooltip" title="${safeLabel}" data-label="${safeLabel}">
          <i class="fas ${icon}"></i>
          <div class="tooltiptext">${safeLabel}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    return '';
  }
}


let map;
let geoLayer;
let priceZones = [];

function createMap() {
  map = L.map('statMap', {
    center: [46.5, 2.5], // Centre France
    zoom: 5,
    minZoom: 5,
    maxBounds: [[41, -5], [51.5, 10]],
    maxBoundsViscosity: 1.0,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

async function loadGeoJson(type) {
  if (geoLayer) {
    map.removeLayer(geoLayer);
  }

  const file = type === "region" ? "/static/regions.geojson" : "/static/departements.geojson";

  const res = await fetch(file);
  const geojson = await res.json();

  geoLayer = L.geoJSON(geojson, {
    style: styleFeature,
    onEachFeature: onEachFeature
  }).addTo(map);
}

function styleFeature(feature) {
  const name = feature.properties.nom; // On suppose propriété 'nom'
  const matching = priceZones.find(p => p.nom === name);
  const value = matching ? matching.valeur : null;

  return {
    fillColor: getColor(value),
    weight: 1,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7
  };
}

function getColor(price) {
    if (!window.globalMinPrice || !window.globalMaxPrice || window.globalMinPrice === window.globalMaxPrice) {
        return '#888';
    }
    const ratio = Math.min(Math.max((price - window.globalMinPrice) / (window.globalMaxPrice - window.globalMinPrice), 0), 1);

    let r, g;
    if (ratio < 0.5) {
        r = Math.floor(255 * (ratio * 2));
        g = 255;
    } else {
        r = 255;
        g = Math.floor(255 * (1 - (ratio - 0.5) * 2));
    }

    return `rgb(${r},${g},80)`;
}

function onEachFeature(feature, layer) {
  const name = feature.properties.nom;
  const matching = priceZones.find(p => p.nom === name);

  layer.bindTooltip(`${name}<br>${matching ? matching.valeur.toFixed(3) + "€" : '–'}`, { sticky: true });

  layer.on({
    click: () => {
      currentSelectedZone = name;
      loadOverviewData(); // Recharge tout
    }
  });
}

async function updateMap(zones) {
  priceZones = zones; // Stockage global
  await loadGeoJson(currentZoneType);
}

createMap()

// Filtres
document.getElementById("fuelSelect").addEventListener("change", e => {
  currentFuel = e.target.value;
  loadOverviewData();
});

document.getElementById("regionButton").addEventListener("click", () => {
  currentZoneType = "region";
  loadOverviewData();
});

document.getElementById("departementButton").addEventListener("click", () => {
  currentZoneType = "departement";
  loadOverviewData();
});

// Démarrage
window.addEventListener("load", loadOverviewData);
