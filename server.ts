import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      system: 'Nusantara POS & Resto Server',
      timestamp: new Date().toISOString()
    });
  });

  // Simulated push notification endpoint for real-time order alerts
  app.post('/api/push-notify', (req, res) => {
    const { target, title, message, orderId } = req.body;
    console.log(`[PUSH NOTIFICATION] Target: ${target} | Title: ${title} | ${message}`);
    res.json({
      success: true,
      deliveredAt: new Date().toISOString(),
      details: { target, title, message, orderId }
    });
  });

  // Simulated Supabase/Cloudinary sync mock endpoints
  app.get('/api/sync/status', (_req, res) => {
    res.json({
      supabaseConnected: true,
      cloudinaryStorage: 'Optimal (Free Tier - 25GB)',
      syncLatencyMs: 42,
      lastSyncedAt: new Date().toISOString()
    });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nusantara POS & Resto full-stack server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
