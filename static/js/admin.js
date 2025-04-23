let daysRange = 7;
let startDate = new Date();
startDate.setDate(startDate.getDate() - daysRange);
let endDate = new Date();
endDate.setDate(endDate.getDate());

const API_BASE_URL = `${window.location.protocol}//${window.location.host}`;

function formatDate(date) {
    return date.toISOString().split("T")[0];
}

function updatePeriodLabel() {
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    const startStr = startDate.toLocaleDateString('fr-FR', options);
    const endStr = endDate.toLocaleDateString('fr-FR', options);
    document.getElementById("periodLabel").textContent = `${startStr} – ${endStr}`;
}

function loadAdminData() {
    updatePeriodLabel();
    const params = `from=${formatDate(startDate)}&to=${formatDate(endDate)}`;
    fetch(`${API_BASE_URL}/api/admin/data?${params}`)
        .then(res => res.json())
        .then(data => {
            if (!Array.isArray(data)) return;
            renderSummaryStats(data);
            renderUserGraph(data);
            renderPathTable(data);
            renderGeolocPie(data);
            renderVisitMap(data); // à compléter si tu veux heatmap ou densité
        });
}

function renderSummaryStats(data) {
    const users = new Set();
    const newUsers = new Set();
    const pageViewsPerUser = {};
    let stationViews = 0;

    data.forEach(e => {
        users.add(e.user_id);
        if (e.type === "new_user") {
            newUsers.add(e.user_id);
        }
        if (e.type === "pageview") {
            pageViewsPerUser[e.user_id] = (pageViewsPerUser[e.user_id] || 0) + 1;
        }
        if (e.type === "stationClick") {
            stationViews++;
        }
    });

    const values = Object.values(pageViewsPerUser);
    const avgPageViews = values.length > 0
        ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)
        : "0";

    document.getElementById("stat-unique-users").textContent = users.size;
    document.getElementById("stat-new-users").textContent = newUsers.size;
    document.getElementById("stat-avg-visits").textContent = avgPageViews;
    document.getElementById("stat-station-views").textContent = stationViews;
}


function renderUserGraph(data) {
    const byDay = {};

    data.forEach(e => {
        const date = e.timestamp.split("T")[0];
        if (!byDay[date]) byDay[date] = { total: new Set(), new: new Set(), returning: new Set() };

        byDay[date].total.add(e.user_id);

        if (e.type === "new_user") {
            byDay[date].new.add(e.user_id);
        } else {
            byDay[date].returning.add(e.user_id);
        }
    });

    const days = Object.keys(byDay).sort();
    const newUsers = days.map(d => byDay[d].new.size);
    const totalUsers = days.map(d => byDay[d].total.size);
    const returningUsers = days.map(d => byDay[d].returning.size);

    Plotly.newPlot("chartUsers", [
        { x: days, y: totalUsers, name: "Total", type: "scatter", line: { color: "#2196f3" } },
        { x: days, y: newUsers, name: "Nouveaux", type: "scatter", line: { color: "#4caf50" } },
        { x: days, y: returningUsers, name: "Revenus", type: "scatter", line: { color: "#ff9800" } }
    ], {
        margin: { t: 30 },
        yaxis: { title: "Utilisateurs" },
        height: 372,
        legend: { x: 0, y: 1.1, orientation: "h" }
    }, {
        responsive: true,
        displayModeBar: false,
        displaylogo: false
    });
}

function renderPathTable(data) {
    const pathsByUser = {};

    data.forEach(e => {
        if (e.type !== "pageview") return;
        if (!pathsByUser[e.user_id]) pathsByUser[e.user_id] = [];
        pathsByUser[e.user_id].push({ page: e.page, time: new Date(e.timestamp) });
    });

    const fullPaths = Object.values(pathsByUser).map(pages => {
        const sorted = pages.sort((a, b) => a.time - b.time);
        const shortPath = sorted.slice(0, 3).map(p => p.page).join(" → ");
        return shortPath;
    });

    const counts = {};
    fullPaths.forEach(path => {
        counts[path] = (counts[path] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const total = Object.keys(pathsByUser).length;

    // Affichage dans le tableau
    const table = document.getElementById("pathsTable");
    table.innerHTML = "";
    sorted.forEach(([path, count], i) => {
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>#${i + 1}</td>
      <td>${path}</td>
      <td>${count}</td>
      <td>${((count / total) * 100).toFixed(1)}%</td>
    `;
        table.appendChild(row);
    });
}

function renderGeolocPie(data) {
    let allowed = 0, denied = 0;

    data.forEach(e => {
        if (e.type === "geolocUsed") allowed++;
        else if (e.type === "geolocDenied") denied++;

    });

    const total = allowed + denied;
    if (total === 0) {
        document.getElementById("geolocPie").innerHTML = "Aucune donnée de géolocalisation.";
        return;
    }

    Plotly.newPlot("geolocPie", [{
        values: [allowed, denied],
        labels: ["Activée", "Refusée"],
        type: "pie",
        marker: {
            colors: ["#4caf50", "#f44336"]
        },

        textinfo: "label+percent",
        hoverinfo: "label+value"
    }], {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { t: 0, b: 0, l: 0, r: 0 },
        height: 100,
        showlegend: false
    }, {
        responsive: true,
        displayModeBar: false,
        displaylogo: false
    });
}

function getColor(intensity) {
    if (intensity < 0.2) return '#e0f3f8';
    if (intensity < 0.4) return '#abd9e9';
    if (intensity < 0.6) return '#74add1';
    if (intensity < 0.8) return '#4575b4';
    return '#313695';
}

function renderVisitMap(data) {
    const visitMap = L.map("visitMap", {
        center: [46.5, 2.5],
        zoom: 5,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(visitMap);

    const coords = data
        .filter(e => e.data && e.data.latitude && e.data.longitude)
        .map(e => [parseFloat(e.data.longitude), parseFloat(e.data.latitude)]) // GeoJSON = [lon, lat]
        .filter(([lon, lat]) => !isNaN(lat) && !isNaN(lon));

    fetch("/static/regions.geojson")
        .then(res => res.json())
        .then(geojson => {
            const regionCounts = {};

            geojson.features.forEach(feature => {
                regionCounts[feature.properties.nom] = 0;
            });

            coords.forEach(([lon, lat]) => {
                const pt = turf.point([lon, lat]);
                geojson.features.forEach(feature => {
                    if (turf.booleanPointInPolygon(pt, feature)) {
                        const nom = feature.properties.nom;
                        regionCounts[nom]++;
                    }
                });
            });

            const max = Math.max(...Object.values(regionCounts));

            L.geoJSON(geojson, {
                style: feature => {
                    const count = regionCounts[feature.properties.nom] || 0;
                    const intensity = max ? count / max : 0;
                    const color = getColor(intensity); // entre 0 et 1
                    return {
                        fillColor: color,
                        weight: 1,
                        color: '#444',
                        fillOpacity: 0.6
                    };
                },
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.nom;
                    const count = regionCounts[name];
                    layer.bindTooltip(`${name}<br>${count} visite(s)`, { sticky: true });
                }
            }).addTo(visitMap);
        });

}

document.getElementById("prevPeriod").addEventListener("click", () => {
    endDate.setDate(startDate.getDate() - 1);
    startDate.setDate(endDate.getDate() - daysRange);
    loadAdminData();
});

document.getElementById("nextPeriod").addEventListener("click", () => {
    startDate.setDate(endDate.getDate() + 1);
    endDate.setDate(startDate.getDate() + daysRange);
    loadAdminData();
});

updatePeriodLabel();
loadAdminData();

