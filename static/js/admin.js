let daysRange = 7;
let startDate = new Date();
startDate.setDate(startDate.getDate() - daysRange);
let endDate = new Date();
endDate.setDate(endDate.getDate() + 1);

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
      renderUserStats(data);
      renderUserGraph(data);
      renderPathTable(data);
      renderGeolocPie(data);
      renderVisitMap(data); // à compléter si tu veux heatmap ou densité
    });
}

function renderUserStats(data) {
  const users = new Set();
  const firstSeen = new Map();
  const viewCounts = {};

  data.forEach(event => {
    users.add(event.user_id);
    if (!firstSeen.has(event.user_id)) firstSeen.set(event.user_id, event.timestamp);
    if (event.type === "stationClick") {
      viewCounts[event.user_id] = (viewCounts[event.user_id] || 0) + 1;
    }
  });

  const newUsers = Array.from(firstSeen.values()).filter(t => t >= formatDate(startDate));
  const leaveEvents = data.filter(e => e.type === "leave" && e.data?.durationMs);
  const avgTime = leaveEvents.length ? leaveEvents.reduce((a,b) => a + b.data.durationMs, 0) / leaveEvents.length : 0;

  const stats = [
    `Utilisateurs uniques : ${users.size}`,
    `Nouveaux utilisateurs : ${newUsers.length}`,
    `Durée moyenne : ${(avgTime / 1000).toFixed(1)} s`,
    `Pompes visualisées : ${Object.values(viewCounts).reduce((a,b) => a + b, 0)}`
  ];

  const list = document.getElementById("statsList");
  list.innerHTML = stats.map(s => `<li>${s}</li>`).join("");
}

function renderUserGraph(data) {
  const byDay = {};

  data.forEach(e => {
    const date = e.timestamp.split("T")[0];
    if (!byDay[date]) byDay[date] = { total: new Set(), new: new Set(), seen: new Set() };
    byDay[date].total.add(e.user_id);
    if (!byDay[date].seen.has(e.user_id)) {
      byDay[date].new.add(e.user_id);
      byDay[date].seen.add(e.user_id);
    }
  });

  const days = Object.keys(byDay).sort();
  const newUsers = days.map(d => byDay[d].new.size);
  const totalUsers = days.map(d => byDay[d].total.size);
  const oldUsers = days.map((_, i) => totalUsers[i] - newUsers[i]);

  Plotly.newPlot("chartUsers", [
    { x: days, y: totalUsers, name: "Total", type: "scatter", line: { color: "#2196f3" } },
    { x: days, y: newUsers, name: "Nouveaux", type: "scatter", line: { color: "#4caf50" } },
    { x: days, y: oldUsers, name: "Revenus", type: "scatter", line: { color: "#ff9800" } }
  ], {
    margin: { t: 30 },
    yaxis: { title: "Utilisateurs" },
    legend: { x: 0, y: 1.1, orientation: "h" }
  });
}

document.querySelectorAll("[data-range]").forEach(btn => {
  btn.addEventListener("click", () => {
    daysRange = parseInt(btn.dataset.range);
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(endDate.getDate() - daysRange);
    loadAdminData();
  });
});

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

