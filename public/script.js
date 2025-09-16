let currentView = 'all';

// Load events on page load
window.addEventListener('DOMContentLoaded', () => {
    loadAll();
    setInterval(updateRelativeTime, 60000); // Update time every minute
});

async function fetchEvents(endpoint = '/api/events') {
    showLoading();
    try {
        const response = await fetch(endpoint);
        const data = await response.json();
        displayEvents(data.events);
        updateInfo(data);
        hideLoading();
    } catch (error) {
        console.error('Error fetching events:', error);
        hideLoading();
        showNoEvents();
    }
}

function displayEvents(events) {
    const tbody = document.getElementById('eventsBody');
    tbody.innerHTML = '';
    
    if (!events || events.length === 0) {
        showNoEvents();
        return;
    }
    
    hideNoEvents();
    
    events.forEach(event => {
        const row = document.createElement('tr');
        
        // Format date
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        // Check if actual differs from forecast
        let actualClass = '';
        if (event.actual !== '-' && event.forecast !== '-') {
            const actual = parseFloat(event.actual);
            const forecast = parseFloat(event.forecast);
            if (!isNaN(actual) && !isNaN(forecast)) {
                actualClass = actual > forecast ? 'actual-positive' : 'actual-negative';
            }
        }
        
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${event.time}</td>
            <td><span class="currency">${event.currency}</span></td>
            <td><strong>${event.event}</strong></td>
            <td><span class="impact-high">${event.impact}</span></td>
            <td class="${actualClass}">${event.actual}</td>
            <td>${event.forecast}</td>
            <td>${event.previous}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateInfo(data) {
    if (data.lastUpdate) {
        const date = new Date(data.lastUpdate);
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById('lastUpdate').textContent = `Last update: ${timeStr}`;
    }
    
    document.getElementById('eventCount').textContent = `${data.count || 0} events`;
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('eventsContainer').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('eventsContainer').style.display = 'block';
}

function showNoEvents() {
    document.getElementById('noEvents').style.display = 'block';
    document.getElementById('eventsContainer').style.display = 'none';
}

function hideNoEvents() {
    document.getElementById('noEvents').style.display = 'none';
}

async function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Refreshing...';
    
    try {
        const response = await fetch('/api/refresh', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            // Reload current view
            if (currentView === 'today') {
                await loadToday();
            } else if (currentView === 'week') {
                await loadWeek();
            } else {
                await loadAll();
            }
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Refresh';
    }
}

async function loadToday() {
    currentView = 'today';
    highlightButton('todayBtn');
    await fetchEvents('/api/events/today');
}

async function loadWeek() {
    currentView = 'week';
    highlightButton('weekBtn');
    await fetchEvents('/api/events/week');
}

async function loadAll() {
    currentView = 'all';
    highlightButton('allBtn');
    await fetchEvents('/api/events');
}

function highlightButton(buttonId) {
    // Reset all buttons
    document.querySelectorAll('.controls button').forEach(btn => {
        btn.style.opacity = '0.7';
    });
    
    // Highlight selected button
    const selectedBtn = document.getElementById(buttonId);
    if (selectedBtn) {
        selectedBtn.style.opacity = '1';
    }
}

function updateRelativeTime() {
    // Update relative time display if needed
    if (currentView === 'today') {
        loadToday();
    }
}
