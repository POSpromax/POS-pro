import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    const checks = {
      supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabasePublicKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY),
      supabaseServerKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      cloudinaryCredentials: Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_CLOUD_NAME))
    };
    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503);
    res.json({
      status: ready ? 'ready' : 'configuration_required',
      checks
    });
  });

  app.post('/api/push-notify', (_req, res) => {
    res.status(501).json({error: 'Push notification adapter belum dikonfigurasi'});
  });

  app.get('/api/sync/status', (_req, res) => {
    res.status(501).json({status: 'not_implemented', message: 'Adapter sinkronisasi transaksi belum aktif'});
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
