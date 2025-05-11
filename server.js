import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors({
  origin: 'https://sydney-event.netlify.app',
  methods: ['GET'],
  credentials: true,
}));

app.get('/api/events', async (req, res) => {
  let browser;

  try {
    console.log('Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('Navigating to Eventbrite...');
    await page.goto('https://www.eventbrite.com/d/australia--sydney/events', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Scraping event list...');
    const events = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-event-id]'));

      if (cards.length === 0) throw new Error('No events found. Selectors might be outdated.');

      return cards.slice(0, 10).map((card, i) => {
        const title = card.querySelector('div.eds-event-card__formatted-name--is-clamped')?.innerText || '';
        const date = card.querySelector('div.eds-event-card-content__sub-title')?.innerText || '';
        const location = card.querySelector('div.card-text--truncated__one')?.innerText || '';
        const image = (() => {
          const img = card.querySelector('img');
          return img?.src || '';
        })();
        const href = card.querySelector('a')?.getAttribute('href') || '';
        const link = href.startsWith('http') ? href : `https://www.eventbrite.com${href}`;

        return { id: i, title, date, location, image, link };
      });
    });

    // Optional: fetch description for each event
    for (let event of events) {
      try {
        const eventPage = await browser.newPage();
        await eventPage.goto(event.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const description = await eventPage.evaluate(() => {
          const desc = document.querySelector('[data-automation="listing-event-description"]');
          return desc ? desc.innerText.trim().slice(0, 300) + '...' : 'No description available.';
        });

        event.description = description;
        await eventPage.close();
      } catch (e) {
        console.warn(`Failed to fetch description for ${event.title}:`, e.message);
        event.description = 'Description unavailable.';
      }
    }

    await browser.close();
    console.log('Scraping complete. Sending data...');
    res.json(events);
  } catch (error) {
    if (browser) await browser.close();
    console.error('Scraping error:', error.message);
    res.status(500).json({ error: 'Scraping failed', details: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
