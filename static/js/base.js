const API_BASE_URL = `${window.location.protocol}//${window.location.host}`;

if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', crypto.randomUUID());
    fetch(`${API_BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: localStorage.getItem('userId'),
            type: "new_user",
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        })
    });
}
const userId = localStorage.getItem('userId');


function trackPageView(page) {
    fetch(`${API_BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            type: "pageview",
            page,
            timestamp: new Date().toISOString()
        })
    });
}

function trackEvent(type, data = {}) {
    fetch(`${API_BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            type,
            data,
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        })
    });
}

function trackLeave(page, durationMs) {
    fetch(`${API_BASE_URL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId,
            page,
            type: "leave",
            durationMs
        })
    });
}
