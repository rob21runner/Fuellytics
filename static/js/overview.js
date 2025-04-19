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
