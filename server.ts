import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // GitHub OAuth Exchange Endpoint
  app.post('/api/exchange', async (req, res) => {
    const { code, code_verifier } = req.body;
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;

    if (!client_id || !client_secret) {
      return res.status(500).json({ error: 'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured on server.' });
    }

    try {
      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id,
        client_secret,
        code,
        code_verifier,
      }, {
        headers: {
          'Accept': 'application/json',
        },
      });

      res.json(response.data);
    } catch (error: any) {
      console.error('Exchange error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to exchange code for token.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
