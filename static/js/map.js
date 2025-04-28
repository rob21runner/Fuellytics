window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splashScreen').classList.add('hidden');
  }, 2000);
});


const map = L.map('map', {
    zoomControl: false,
    minZoom: 6,
    maxBounds: [[41, -5], [51.5, 10]],
    maxBoundsViscosity: 1.0
}).setView([46.5, 2.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

trackPageView("map");

let sessionStart = Date.now();

window.addEventListener("beforeunload", () => {
    const duration = Date.now() - sessionStart;
    const payload = {
        type: "leave",
        page: "map",
        data: { durationMs: duration },
        userId: localStorage.getItem("userId")
    };

    navigator.sendBeacon(`${API_BASE_URL}/track`, new Blob([JSON.stringify(payload)], {
        type: "application/json"
    }));
});

function playSound(path) {
  const sound = new Audio(path);
  sound.volume = 0.1;
  sound.play();
}

const stationsCache = new Map();
let fuelType = localStorage.getItem('preferredFuel') || 'SP95';
const minZoomToFetch = 11;
let lastFetchedBounds = null;
let selectedMarker = null;

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

const fuelSelect = document.getElementById("fuelSelect");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

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

if (searchButton && searchInput) {
    function searchLocation() {
        const location = searchInput.value;
        if (!location) return;

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const place = data[0];
                    map.setView([parseFloat(place.lat), parseFloat(place.lon)], 13);
                }
            });
    }
    searchButton.addEventListener("click", searchLocation)
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === 'Enter') {
            searchLocation()
            trackEvent("search", { query: searchInput.value });
        }
    })
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

    return `rgb(${r},${g},0)`;
}


function fetchStations() {
    if (map.getZoom() < minZoomToFetch) return;

    const bounds = map.getBounds();

    if (lastFetchedBounds && lastFetchedBounds.contains(bounds)) {
        updateMarkersVisibility();
        return;
    }
    const loading = document.getElementById("loadingMessage");
    if (loading) loading.style.display = 'block';

    // Étendre la zone de fetch pour éviter les requêtes inutiles au moindre mouvement
    lastFetchedBounds = bounds.pad(0.3);

    const params = new URLSearchParams({
        x_min: lastFetchedBounds.getWest(),
        y_min: lastFetchedBounds.getSouth(),
        x_max: lastFetchedBounds.getEast(),
        y_max: lastFetchedBounds.getNorth(),
        fuel: fuelType
    });

    fetch(`${API_BASE_URL}/stations?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            if (data.length > 0) {
                const prices = data.map(st => st.prix);
                window.globalMinPrice = Math.min(...prices);
                window.globalMaxPrice = Math.max(...prices);
            }
            data.forEach(station => {
                if (!stationsCache.has(station.id)) {
                    const marker = L.marker([station.latitude, station.longitude], {
                        icon: L.divIcon({
                            className: 'price-marker',
                            html: `<div style="
                                    background: ${getColor(station.prix)};
                                    border-radius: 50%;
                                    width: 32px;
                                    height: 32px;
                                    padding: 5px;
                                    line-height: 32px;
                                    text-align: center;
                                    color: white;
                                    font-size: 12px;
                                    font-weight: bold;
                                    box-shadow: 0 0 4px rgba(0,0,0,0.4);
                                    text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);
                                ">${station.prix.toFixed(2)}€</div>`
                        })
                    });
                    marker.on('click', () => {
                        if (selectedMarker) {
                            try {
                                selectedMarker.getElement().children[0].style.boxShadow = '';
                                selectedMarker.getElement().children[0].style.transform = 'scale(1)';
                            } catch (err) {
                                selectedMarker = null
                            }
                        }
                        selectedMarker = marker;
                        marker.getElement().children[0].style.boxShadow = '0 0 10px 4px rgba(255,255,255,0.7)';
                        marker.getElement().children[0].style.transform = 'scale(1.2)';
                        marker.getElement().children[0].style.transition = 'transform 0.2s, box-shadow 0.2s';
                        fetchHistory(station.id)
                        trackEvent("stationClick", {
                            stationId: station.id,
                            carburant: fuelType,
                            price: station.prix
                        });
                    })

                    stationsCache.set(station.id, marker);
                }
            });

            updateMarkersVisibility();
            const loading = document.getElementById("loadingMessage");
            if (loading) loading.style.display = 'none';
        });
}


function updateMarkersVisibility() {
    const bounds = map.getBounds();

    stationsCache.forEach((marker, id) => {
        if (bounds.contains(marker.getLatLng())) {
            if (!map.hasLayer(marker)) {
                marker.addTo(map);
            }
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        }
    });
}

function fetchHistory(stationId) {
    fetch(`${API_BASE_URL}/stations/${stationId}/history`)
        .then(res => {
            const loading = document.getElementById("loadingMessage");
            if (loading) loading.style.display = 'block';
            return res.json()
        })
        .then(({ station, history }) => {
            const historyBox = document.getElementById("historyBox");

            if (!history || Object.keys(history).length === 0) {
                historyBox.style.display = "none";
                return;
            }

            // historyBox.style.visibility = "hidden";
            historyBox.style.display = "block";

            let servicesHtml = '';
            try {
                const parsed = JSON.parse(station.services);
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
            } catch (e) {
                servicesHtml = '';
            }

            document.getElementById("stationInfo").innerHTML = `
                                    <div class="station-header">
                                        <strong>${station.adresse}, ${station.ville}</strong>
                                    </div>
                                    <div class="cat-header">⛽ Prices</div>
                                    <div class="station-prices">
                                        <table><thead><tr>
                                            ${['SP95','SP98','Gazole','E10','E85','GPLc'].map(c => `<th style="">${c}</th>`).join('')}
                                        </tr></thead><tbody><tr>
                                            ${['SP95','SP98','Gazole','E10','E85','GPLc'].map(c => `<td style="">${station.prix_actuels[c] ? station.prix_actuels[c].toFixed(3) + '€' : '–'}</td>`).join('')}
                                        </tr></tbody></table>
                                    </div>
                                    <div class="cat-header">🏪 Services</div>
                                    <div class="station-services">
                                        ${servicesHtml}
                                    </div>
            `;

            requestAnimationFrame(() => {
                document.querySelectorAll('.service-icon.tooltip').forEach(el => {
                    const tooltip = el.querySelector('.tooltiptext');
                    if (!tooltip) return;

                    const rect = tooltip.getBoundingClientRect();
                    const margin = 25;

                    el.classList.remove('left', 'right');

                    if (rect.left  < margin) {
                        el.classList.add('left');
                    } else if (window.innerWidth - rect.right < margin) {
                        el.classList.add('right');
                    }
                });
            });

            const fuelColors = {
                SP95: '#16a085',
                SP98: '#1abc9c',
                E10: '#2ecc71',
                E85: '#3498db',
                Gazole: '#f1c40f',
                GPLc: '#34495e'
            };

            const traces = Object.entries(history).map(([carburant, entries]) => {
                const sortedEntries = entries.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
                return {
                    x: sortedEntries.map(p => p.date),
                    y: sortedEntries.map(p => p.valeur),
                    name: carburant,
                    line: { color: fuelColors[carburant] || undefined },
                    type: 'scatter',
                    mode: 'lines+markers'
                };
            });

            Plotly.newPlot('historyChart', traces, {
                margin: { t: 20, r: 10, l: 40, b: 40 },
                font: {
                    color: textColor
                },
                yaxis: {
                    title: 'Prix (€)',
                    range: [0, 2.5]
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                xaxis: {
                    title: 'Date',
                    type:'date'
                }
            }, {
                responsive: true,
                displayModeBar: false,
                displaylogo: false
            }).then(() => {
                playSound("static/sounds/bubbles.mp3");
                historyBox.classList.add("show")
                Plotly.Plots.resize('historyChart');
            });
            const loading = document.getElementById("loadingMessage");
            if (loading) loading.style.display = 'none';
        });
}

map.on('moveend', fetchStations);

map.on('click', () => {
    if (selectedMarker) {
        document.getElementById("historyBox").classList.remove("show")
        playSound("static/sounds/paper.mp3");
        setTimeout(() => {
            document.getElementById("historyBox").style.display = "none";
        }, 300);
        try {
            selectedMarker.getElement().children[0].style.boxShadow = '';
            selectedMarker.getElement().children[0].style.transform = 'scale(1)';
        } catch (err) {
            selectedMarker = null
        }

    }


});

function isInFrance(lat, lon) {
    const southWest = L.latLng(41, -5);   // approximatif
    const northEast = L.latLng(51.5, 10);
    const bounds = L.latLngBounds(southWest, northEast);
    return bounds.contains([lat, lon]);
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            trackEvent("geolocUsed", {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            });
            const { latitude, longitude } = pos.coords;
            if (isInFrance(latitude, longitude)) {
                map.setView([latitude, longitude], 13);
            }
            fetchStations();
        },
        (err) => {
            trackEvent("geolocDenied", { code: err.code, message: err.message });
            fetchStations();
        }
    );
} else {
    trackEvent("geolocUnsupported");
    fetchStations();
}