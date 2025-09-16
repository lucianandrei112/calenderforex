const axios = require('axios');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');

// Generate random user agent
function getRandomUserAgent() {
    const userAgent = new UserAgent();
    return userAgent.toString();
}

// Helper to parse dates
function parseEventDate(dateStr, timeStr) {
    const now = new Date();
    let eventDate = new Date();
    
    // Try to parse date
    if (dateStr && dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length >= 2) {
            eventDate.setMonth(parseInt(parts[0]) - 1);
            eventDate.setDate(parseInt(parts[1]));
        }
    }
    
    // Parse time
    if (timeStr && timeStr.includes(':')) {
        const timeParts = timeStr.split(':');
        let hours = parseInt(timeParts[0]);
        let minutes = parseInt(timeParts[1]);
        
        if (timeStr.toLowerCase().includes('pm') && hours < 12) {
            hours += 12;
        }
        
        eventDate.setHours(hours, minutes, 0, 0);
    }
    
    return eventDate;
}

// Scraper voor Myfxbook
async function scrapeMyfxbook() {
    console.log('Trying Myfxbook...');
    try {
        const response = await axios.get('https://www.myfxbook.com/forex-economic-calendar', {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const events = [];
        
        // Myfxbook calendar table
        $('.economicCalendarTable tbody tr, .calendar-row').each((i, elem) => {
            const $row = $(elem);
            
            // Check for high impact
            const impact = $row.find('.high-impact, .impact-high, .cal-impact-3').length > 0 ||
                          $row.find('td').eq(4).text().includes('High');
            
            if (impact) {
                const date = $row.find('td').eq(0).text().trim();
                const time = $row.find('td').eq(1).text().trim();
                const currency = $row.find('td').eq(2).text().trim();
                const event = $row.find('td').eq(3).text().trim();
                const actual = $row.find('td').eq(5).text().trim();
                const forecast = $row.find('td').eq(6).text().trim();
                const previous = $row.find('td').eq(7).text().trim();
                
                if (event) {
                    const eventDate = parseEventDate(date, time);
                    events.push({
                        datetime: eventDate.toISOString(),
                        date: eventDate.toISOString().split('T')[0],
                        time: time || 'All Day',
                        currency: currency || 'N/A',
                        country: getCountryFromCurrency(currency),
                        event: event,
                        impact: 'High',
                        volatility: 'High',
                        actual: actual || null,
                        forecast: forecast || null,
                        previous: previous || null
                    });
                }
            }
        });
        
        return { events, source: 'Myfxbook' };
    } catch (error) {
        console.error('Myfxbook failed:', error.message);
        throw error;
    }
}

// Scraper voor DailyFX
async function scrapeDailyFX() {
    console.log('Trying DailyFX...');
    try {
        const response = await axios.get('https://www.dailyfx.com/economic-calendar', {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.dailyfx.com/'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const events = [];
        
        // DailyFX structure
        $('.dfx-economicCalendarTable tbody tr').each((i, elem) => {
            const $row = $(elem);
            const impactClass = $row.attr('class') || '';
            
            if (impactClass.includes('high')) {
                const timeStr = $row.find('.date').text().trim();
                const currency = $row.find('.currency').text().trim();
                const event = $row.find('.event').text().trim();
                const actual = $row.find('.actual').text().trim();
                const forecast = $row.find('.forecast').text().trim();
                const previous = $row.find('.previous').text().trim();
                
                if (event) {
                    const now = new Date();
                    events.push({
                        datetime: now.toISOString(),
                        date: now.toISOString().split('T')[0],
                        time: timeStr || 'TBD',
                        currency: currency || 'N/A',
                        country: getCountryFromCurrency(currency),
                        event: event,
                        impact: 'High',
                        volatility: 'High',
                        actual: actual || null,
                        forecast: forecast || null,
                        previous: previous || null
                    });
                }
            }
        });
        
        return { events, source: 'DailyFX' };
    } catch (error) {
        console.error('DailyFX failed:', error.message);
        throw error;
    }
}

// Scraper voor FXStreet
async function scrapeFXStreet() {
    console.log('Trying FXStreet...');
    try {
        // FXStreet API endpoint (public)
        const response = await axios.get('https://calendar.fxstreet.com/EventDateWidget/GetMini', {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'application/json',
                'Referer': 'https://www.fxstreet.com/economic-calendar'
            },
            params: {
                culture: 'en-US',
                view: 'range',
                start: new Date().toISOString().split('T')[0],
                end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            timeout: 10000
        });

        const events = [];
        
        // Parse response als het JSON is
        if (typeof response.data === 'string') {
            const $ = cheerio.load(response.data);
            
            $('.fxs_cal_event').each((i, elem) => {
                const $event = $(elem);
                const volatility = $event.attr('data-volatility');
                
                if (volatility === '3' || volatility === 'High') {
                    const dateTime = $event.attr('data-date');
                    const currency = $event.find('.fxs_cal_event_currency').text().trim();
                    const title = $event.find('.fxs_cal_event_title').text().trim();
                    const actual = $event.find('.fxs_cal_event_actual').text().trim();
                    const consensus = $event.find('.fxs_cal_event_consensus').text().trim();
                    const previous = $event.find('.fxs_cal_event_previous').text().trim();
                    
                    if (title) {
                        events.push({
                            datetime: dateTime || new Date().toISOString(),
                            date: dateTime ? dateTime.split('T')[0] : new Date().toISOString().split('T')[0],
                            time: dateTime ? dateTime.split('T')[1].substring(0, 5) : 'TBD',
                            currency: currency || 'N/A',
                            country: getCountryFromCurrency(currency),
                            event: title,
                            impact: 'High',
                            volatility: 'High',
                            actual: actual || null,
                            forecast: consensus || null,
                            previous: previous || null
                        });
                    }
                }
            });
        }
        
        return { events, source: 'FXStreet' };
    } catch (error) {
        console.error('FXStreet failed:', error.message);
        throw error;
    }
}

// Helper functie voor currency naar country
function getCountryFromCurrency(currency) {
    const currencyMap = {
        'USD': 'United States',
        'EUR': 'Euro Zone',
        'GBP': 'United Kingdom',
        'JPY': 'Japan',
        'AUD': 'Australia',
        'CAD': 'Canada',
        'CHF': 'Switzerland',
        'NZD': 'New Zealand',
        'CNY': 'China',
        'INR': 'India'
    };
    return currencyMap[currency] || currency;
}

// Main scraper met fallbacks
async function scrapeMultipleSources() {
    const scrapers = [
        { name: 'Myfxbook', fn: scrapeMyfxbook },
        { name: 'DailyFX', fn: scrapeDailyFX },
        { name: 'FXStreet', fn: scrapeFXStreet }
    ];
    
    for (const scraper of scrapers) {
        try {
            console.log(`Attempting ${scraper.name}...`);
            const result = await scraper.fn();
            
            if (result.events && result.events.length > 0) {
                console.log(`✅ Success! Got ${result.events.length} events from ${scraper.name}`);
                return result;
            }
        } catch (error) {
            console.log(`❌ ${scraper.name} failed, trying next source...`);
        }
    }
    
    // Als alles faalt, return static data
    console.log('⚠️ All scrapers failed, using static data');
    return {
        events: getStaticHighImpactEvents(),
        source: 'static',
        error: 'All scrapers failed'
    };
}

// Static high impact events als ultieme fallback
function getStaticHighImpactEvents() {
    const events = [];
    const now = new Date();
    
    // Week vooruit genereren
    for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        
        // Typical high impact events
        const templates = [
            { time: '08:30', currency: 'EUR', event: 'ECB Economic Bulletin', forecast: null },
            { time: '10:00', currency: 'EUR', event: 'German IFO Business Climate', forecast: '85.2' },
            { time: '14:30', currency: 'USD', event: 'Initial Jobless Claims', forecast: '220K' },
            { time: '14:30', currency: 'USD', event: 'GDP Growth Rate QoQ', forecast: '2.1%' },
            { time: '16:00', currency: 'USD', event: 'FOMC Meeting Minutes', forecast: null },
            { time: '09:30', currency: 'GBP', event: 'GDP Growth Rate YoY', forecast: '0.3%' },
            { time: '02:00', currency: 'JPY', event: 'BoJ Interest Rate Decision', forecast: '-0.10%' },
            { time: '03:30', currency: 'AUD', event: 'RBA Interest Rate Decision', forecast: '4.35%' }
        ];
        
        // Voeg 1-2 random events per dag toe
        const dayEvents = Math.floor(Math.random() * 2) + 1;
        for (let j = 0; j < dayEvents; j++) {
            const template = templates[Math.floor(Math.random() * templates.length)];
            const eventDate = new Date(date);
            const timeParts = template.time.split(':');
            eventDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
            
            events.push({
                datetime: eventDate.toISOString(),
                date: eventDate.toISOString().split('T')[0],
                time: template.time,
                currency: template.currency,
                country: getCountryFromCurrency(template.currency),
                event: template.event,
                impact: 'High',
                volatility: 'High',
                actual: null,
                forecast: template.forecast,
                previous: template.forecast ? (parseFloat(template.forecast) * 0.98).toFixed(1) + '%' : null
            });
        }
    }
    
    return events;
}

module.exports = {
    scrapeMultipleSources
};
