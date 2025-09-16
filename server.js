const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { scrapeEconomicCalendar } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory cache voor events
let cachedEvents = [];
let lastUpdate = null;

// Initial scrape bij opstarten
(async () => {
    console.log('Starting initial scrape...');
    const events = await scrapeEconomicCalendar();
    cachedEvents = events;
    lastUpdate = new Date();
    console.log(`Cached ${events.length} high impact events`);
})();

// Schedule scraping elke 30 minuten
cron.schedule('*/30 * * * *', async () => {
    console.log('Running scheduled scrape...');
    const events = await scrapeEconomicCalendar();
    cachedEvents = events;
    lastUpdate = new Date();
    console.log(`Updated cache with ${events.length} events`);
});

// API Endpoints
app.get('/api/events', (req, res) => {
    res.json({
        events: cachedEvents,
        lastUpdate: lastUpdate,
        count: cachedEvents.length
    });
});

app.get('/api/events/today', (req, res) => {
    const today = new Date().toDateString();
    const todayEvents = cachedEvents.filter(event => {
        const eventDate = new Date(event.date).toDateString();
        return eventDate === today;
    });
    
    res.json({
        events: todayEvents,
        date: today,
        count: todayEvents.length
    });
});

app.get('/api/events/week', (req, res) => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const weekEvents = cachedEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= weekFromNow;
    });
    
    res.json({
        events: weekEvents,
        startDate: now,
        endDate: weekFromNow,
        count: weekEvents.length
    });
});

// Force refresh endpoint
app.post('/api/refresh', async (req, res) => {
    try {
        console.log('Manual refresh triggered...');
        const events = await scrapeEconomicCalendar();
        cachedEvents = events;
        lastUpdate = new Date();
        res.json({
            success: true,
            events: events.length,
            lastUpdate: lastUpdate
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
