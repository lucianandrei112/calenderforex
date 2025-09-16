const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { scrapeMultipleSources } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for n8n
app.use(cors());
app.use(express.json());

// Data store
let cachedEvents = [];
let lastUpdate = null;
let scrapeStatus = 'idle';
let lastError = null;

// Initial scrape
async function initialScrape() {
    console.log('🚀 Starting initial scrape...');
    scrapeStatus = 'running';
    try {
        const result = await scrapeMultipleSources();
        cachedEvents = result.events;
        lastUpdate = new Date();
        lastError = result.error || null;
        scrapeStatus = 'success';
        console.log(`✅ Cached ${cachedEvents.length} events from ${result.source}`);
    } catch (error) {
        console.error('❌ Initial scrape failed:', error);
        scrapeStatus = 'error';
        lastError = error.message;
        cachedEvents = getStaticData(); // Fallback data
        lastUpdate = new Date();
    }
}

// Start initial scrape
initialScrape();

// Schedule updates every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ Running scheduled scrape...');
    scrapeStatus = 'running';
    try {
        const result = await scrapeMultipleSources();
        if (result.events && result.events.length > 0) {
            cachedEvents = result.events;
            lastUpdate = new Date();
            scrapeStatus = 'success';
            lastError = null;
            console.log(`✅ Updated ${cachedEvents.length} events from ${result.source}`);
        }
    } catch (error) {
        console.error('❌ Scheduled scrape failed:', error);
        scrapeStatus = 'error';
        lastError = error.message;
    }
});

// MAIN API ENDPOINT voor n8n
app.get('/api/events', (req, res) => {
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        lastUpdate: lastUpdate,
        source: scrapeStatus === 'success' ? 'live' : 'cache',
        count: cachedEvents.length,
        events: cachedEvents
    });
});

// Filter by impact
app.get('/api/events/high', (req, res) => {
    const highImpact = cachedEvents.filter(e => 
        e.impact === 'High' || e.volatility === 'High'
    );
    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        count: highImpact.length,
        events: highImpact
    });
});

// Today's events
app.get('/api/events/today', (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayEvents = cachedEvents.filter(event => {
        const eventDate = new Date(event.datetime);
        return eventDate >= today && eventDate < tomorrow;
    });
    
    res.json({
        success: true,
        date: today.toISOString(),
        count: todayEvents.length,
        events: todayEvents
    });
});

// This week's events
app.get('/api/events/week', (req, res) => {
    const now = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekEvents = cachedEvents.filter(event => {
        const eventDate = new Date(event.datetime);
        return eventDate >= now && eventDate <= weekEnd;
    });
    
    res.json({
        success: true,
        startDate: now.toISOString(),
        endDate: weekEnd.toISOString(),
        count: weekEvents.length,
        events: weekEvents
    });
});

// Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: scrapeStatus,
        lastUpdate: lastUpdate,
        eventCount: cachedEvents.length,
        lastError: lastError,
        uptime: process.uptime()
    });
});

// Force refresh
app.post('/api/refresh', async (req, res) => {
    if (scrapeStatus === 'running') {
        return res.json({
            success: false,
            message: 'Scrape already in progress'
        });
    }
    
    scrapeStatus = 'running';
    try {
        const result = await scrapeMultipleSources();
        cachedEvents = result.events;
        lastUpdate = new Date();
        scrapeStatus = 'success';
        lastError = null;
        
        res.json({
            success: true,
            source: result.source,
            count: cachedEvents.length,
            timestamp: lastUpdate
        });
    } catch (error) {
        scrapeStatus = 'error';
        lastError = error.message;
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
    });
});

// Root endpoint with API info
app.get('/', (req, res) => {
    res.json({
        name: 'Forex Economic Calendar API',
        version: '2.0.0',
        endpoints: {
            'GET /api/events': 'All events',
            'GET /api/events/high': 'High impact only',
            'GET /api/events/today': 'Today\'s events',
            'GET /api/events/week': 'This week\'s events',
            'GET /api/status': 'API status',
            'POST /api/refresh': 'Force refresh',
            'GET /health': 'Health check'
        },
        lastUpdate: lastUpdate,
        eventCount: cachedEvents.length
    });
});

// Static fallback data
function getStaticData() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return [
        {
            datetime: now.toISOString(),
            date: now.toISOString().split('T')[0],
            time: '14:30',
            currency: 'USD',
            country: 'United States',
            event: 'Non-Farm Payrolls',
            impact: 'High',
            volatility: 'High',
            actual: null,
            forecast: '200K',
            previous: '187K'
        },
        {
            datetime: now.toISOString(),
            date: now.toISOString().split('T')[0],
            time: '14:30',
            currency: 'USD',
            country: 'United States',
            event: 'Unemployment Rate',
            impact: 'High',
            volatility: 'High',
            actual: null,
            forecast: '3.7%',
            previous: '3.8%'
        },
        {
            datetime: tomorrow.toISOString(),
            date: tomorrow.toISOString().split('T')[0],
            time: '09:45',
            currency: 'EUR',
            country: 'Euro Zone',
            event: 'ECB Interest Rate Decision',
            impact: 'High',
            volatility: 'High',
            actual: null,
            forecast: '4.25%',
            previous: '4.25%'
        },
        {
            datetime: tomorrow.toISOString(),
            date: tomorrow.toISOString().split('T')[0],
            time: '13:30',
            currency: 'GBP',
            country: 'United Kingdom',
            event: 'BoE Interest Rate Decision',
            impact: 'High',
            volatility: 'High',
            actual: null,
            forecast: '5.25%',
            previous: '5.25%'
        }
    ];
}

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   Forex Calendar API Running!          ║
║   Port: ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}           ║
╚════════════════════════════════════════╝
    `);
});
