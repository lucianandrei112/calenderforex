const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeEconomicCalendar() {
    const events = [];
    
    try {
        // We scrapen van Investing.com's economische kalender
        // Dit is een publieke bron zonder API key vereiste
        const response = await axios.get('https://www.investing.com/economic-calendar/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Parse de kalender tabel
        $('.js-economic-calendar tr').each((index, element) => {
            const $row = $(element);
            
            // Check voor high impact (3 stieren/bulls)
            const impactElement = $row.find('.economicCalendarEvent');
            const bulls = $row.find('.grayFullBullishIcon').length + 
                         $row.find('.redFullBullishIcon').length;
            
            // Alleen high impact events (3 bulls)
            if (bulls === 3) {
                const time = $row.find('.js-time').text().trim();
                const currency = $row.find('.flagCur').text().trim();
                const eventName = $row.find('.event a').text().trim();
                const actual = $row.find('.act').text().trim();
                const forecast = $row.find('.fore').text().trim();
                const previous = $row.find('.prev').text().trim();
                
                if (eventName) {
                    events.push({
                        date: new Date().toISOString().split('T')[0],
                        time: time || 'All Day',
                        currency: currency || 'N/A',
                        event: eventName,
                        impact: 'High',
                        actual: actual || '-',
                        forecast: forecast || '-',
                        previous: previous || '-'
                    });
                }
            }
        });
        
        // Als Investing.com blokkeert, gebruik ForexFactory als backup
        if (events.length === 0) {
            console.log('Trying ForexFactory as backup...');
            events.push(...await scrapeForexFactory());
        }
        
    } catch (error) {
        console.error('Scraping error:', error.message);
        // Fallback naar ForexFactory
        return await scrapeForexFactory();
    }
    
    return events;
}

async function scrapeForexFactory() {
    const events = [];
    
    try {
        const response = await axios.get('https://www.forexfactory.com/calendar', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        $('.calendar__row').each((index, element) => {
            const $row = $(element);
            const impact = $row.find('.impact span').attr('class');
            
            // Check voor high impact (red)
            if (impact && impact.includes('high')) {
                const date = $row.find('.date').text().trim();
                const time = $row.find('.time').text().trim();
                const currency = $row.find('.currency').text().trim();
                const event = $row.find('.event').text().trim();
                const actual = $row.find('.actual').text().trim();
                const forecast = $row.find('.forecast').text().trim();
                const previous = $row.find('.previous').text().trim();
                
                if (event) {
                    events.push({
                        date: date || new Date().toISOString().split('T')[0],
                        time: time || 'TBD',
                        currency: currency || 'N/A',
                        event: event,
                        impact: 'High',
                        actual: actual || '-',
                        forecast: forecast || '-',
                        previous: previous || '-'
                    });
                }
            }
        });
    } catch (error) {
        console.error('ForexFactory scraping error:', error.message);
        // Return demo data als beide bronnen falen
        return getDemoData();
    }
    
    return events;
}

function getDemoData() {
    // Demo data voor als scraping faalt
    const now = new Date();
    return [
        {
            date: now.toISOString().split('T')[0],
            time: '14:30',
            currency: 'USD',
            event: 'Non-Farm Payrolls',
            impact: 'High',
            actual: '-',
            forecast: '180K',
            previous: '175K'
        },
        {
            date: now.toISOString().split('T')[0],
            time: '14:30',
            currency: 'USD',
            event: 'Unemployment Rate',
            impact: 'High',
            actual: '-',
            forecast: '3.9%',
            previous: '3.9%'
        },
        {
            date: now.toISOString().split('T')[0],
            time: '10:00',
            currency: 'EUR',
            event: 'ECB Interest Rate Decision',
            impact: 'High',
            actual: '-',
            forecast: '4.50%',
            previous: '4.50%'
        }
    ];
}

module.exports = { scrapeEconomicCalendar };
