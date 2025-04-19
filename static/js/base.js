if (!localStorage.getItem('userId')) {
    localStorage.setItem('userId', crypto.randomUUID());
}
const userId = localStorage.getItem('userId');


function trackPageView(page) {
    fetch("/track", {
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
    fetch("/track", {
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
    fetch("/track", {
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
