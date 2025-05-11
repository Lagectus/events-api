import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());

app.get('/api/events', async (req, res) => {
  try {
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
    const page = await browser.newPage();
    await page.goto('https://www.eventbrite.com/d/australia--sydney/events/', {
      waitUntil: 'networkidle2'
    });

    const events = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-event-id]'));
      return cards.slice(0, 20).map((card, i) => {
        const title = card.querySelector('[data-spec="event-card__formatted-name--content"]')?.innerText || '';
        const date = card.querySelector('[data-spec="event-card__date"]')?.innerText || '';
        const location = card.querySelector('[data-spec="event-card__sub-name"]')?.innerText || '';
        const image = (() => {
  const img = card.querySelector('img, source');
  let src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
  return src.replace(/\/\d+x\d+\//, '/800x600/');
})();

        const linkEl = card.querySelector('a');
const href = linkEl?.getAttribute('href') || '';
const link = href.startsWith('http') ? href : `https://www.eventbrite.com${href}`;

        return { id: i, title, date, location, image, link };
      });
    });for (let event of events) {
  try {
    const eventPage = await browser.newPage();
    await eventPage.goto(event.link, { waitUntil: 'domcontentloaded' });

    const description = await eventPage.evaluate(() => {
      const descEl = document.querySelector('[data-automation="listing-event-description"]');
      return descEl ? descEl.innerText.trim().slice(0, 300) + '...' : 'No description available.';
    });

    event.description = description;
    await eventPage.close();
  } catch (e) {
    console.warn(`Failed to fetch description for ${event.title}:`, e.message);
    event.description = 'Description unavailable.';
  }
}


    await browser.close();
    res.json(events);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Scraping failed' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
