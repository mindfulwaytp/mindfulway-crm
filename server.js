import express from 'express';
import fetch from 'node-fetch';
import { createServer as createViteServer } from 'vite';

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbynKe5GKkqUs-nKq9JRlBMJ0TrltZtrSrkt0f4z8QIUfMmdau14kkdct_3b-kK67YE/exec';

async function start() {
  const app = express();
  app.use(express.json());

  app.get('/api/inquiries', async (req, res) => {
    console.log('GET /api/inquiries hit', req.query);

    try {
      const action = req.query.action || 'list';

      const response = await fetch(`${APPS_SCRIPT_URL}?action=${action}`, {
        method: 'GET',
        redirect: 'follow',
      });

      const text = await response.text();
      console.log('Apps Script GET status:', response.status);
      console.log('Apps Script GET body preview:', text.slice(0, 200));

      res.status(response.status).type('application/json').send(text);
    } catch (error) {
      console.error('GET /api/inquiries error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/inquiries', async (req, res) => {
    console.log('POST /api/inquiries hit', req.body);

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(req.body),
        redirect: 'follow',
      });

      const text = await response.text();
      console.log('Apps Script POST status:', response.status);
      console.log('Apps Script POST body preview:', text.slice(0, 200));

      res.status(response.status).type('application/json').send(text);
    } catch (error) {
      console.error('POST /api/inquiries error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(5173, () => {
    console.log('Dev server running at https://mindfulway-os.pages.dev/');
  });
}

start();
