const API_BASE_URL = `${window.location.protocol}//${window.location.host}`;

if (!localStorage.getItem('userId')) {
    if (!crypto.randomUUID) {
        crypto.randomUUID = function() {
            return ([1e7]+-1e3+-4e3+-8e3+-1e11)
                .replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
        };
    }
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
