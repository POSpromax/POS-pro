import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getSupabaseAdmin } from './src/server/supabaseAdmin';
import { handlePinLogin } from './src/server/pinLogin';
import { handleStaffRequest } from './src/server/staffManagement';
import { handleAttendanceRequest } from './src/server/attendanceManagement';
import { handleHrRequest } from './src/server/hrManagement';
import { handleOrderRequest } from './src/server/orderManagement';
import { handleShiftRequest } from './src/server/shiftManagement';
import { getPublicCatalog } from './src/server/publicCatalog';
import { handleCloudinarySign } from './src/server/cloudinarySign';
import { generateQrToken, buildSelfOrderUrl } from './src/utils/qrToken';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    // Supabase menentukan hidup-matinya sistem: tanpa itu kasir tidak bisa
    // login, memesan, atau membaca shift.
    const required = {
      supabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      supabasePublicKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY),
      supabaseServerKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    };
    // Cloudinary hanya untuk unggah foto menu. Tanpa itu POS tetap melayani,
    // jadi jangan laporkan seluruh sistem sebagai mati.
    const optional = {
      cloudinaryCredentials: Boolean(process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && process.env.CLOUDINARY_CLOUD_NAME))
    };
    const ready = Object.values(required).every(Boolean);
    const degraded = ready && !Object.values(optional).every(Boolean);
    res.status(ready ? 200 : 503);
    res.json({
      status: ready ? (degraded ? 'degraded' : 'ready') : 'configuration_required',
      checks: { ...required, ...optional }
    });
  });

  // Tanpa route ini, unggah foto di localhost jatuh ke SPA fallback dan
  // fotonya hanya jadi blob sementara yang hilang saat halaman dimuat ulang.
  app.post('/api/cloudinary-sign', async (req, res) => {
    try {
      const result = await handleCloudinarySign(
        'POST',
        req.header('Authorization') || '',
        req.body || {},
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      console.error('[CLOUDINARY SIGN ERROR]:', err);
      res.status(503).json({ error: 'Layanan media belum dikonfigurasi' });
    }
  });

  app.post('/api/auth/pin-login', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const payload = req.body || {};
      const result = await handlePinLogin(payload, admin);
      res.status(result.status).json(result.data);
    } catch (err) {
      console.error('[PIN LOGIN EXPRESS ERROR]:', err);
      res.status(503).json({ error: err instanceof Error ? err.message : 'Server autentikasi belum dikonfigurasi' });
    }
  });

  app.all('/api/staff', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const authorization = req.header('Authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const result = await handleStaffRequest(req.method, req.body || {}, accessToken, admin);
      res.status(result.status).json(result.data);
    } catch {
      res.status(503).json({ error: 'Server staff belum dikonfigurasi' });
    }
  });

  app.all('/api/attendance', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const authorization = req.header('Authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const result = await handleAttendanceRequest(req.method, req.method === 'GET' ? req.query : (req.body || {}), accessToken, admin);
      res.status(result.status).json(result.data);
    } catch {
      res.status(503).json({ error: 'Server absensi belum dikonfigurasi' });
    }
  });

  app.all('/api/hr', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const authorization = req.header('Authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const result = await handleHrRequest(req.method, req.method === 'GET' ? req.query : (req.body || {}), accessToken, admin);
      res.status(result.status).json(result.data);
    } catch {
      res.status(503).json({ error: 'Server HR belum dikonfigurasi' });
    }
  });

  app.all('/api/orders', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const authorization = req.header('Authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const payload = req.method === 'GET' ? req.query : (req.body || {});
      const result = await handleOrderRequest(req.method, payload, accessToken, admin);
      res.status(result.status).json(result.data);
    } catch {
      res.status(503).json({ error: 'Server pesanan belum dikonfigurasi' });
    }
  });

  app.all('/api/shifts', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const authorization = req.header('Authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      const payload = req.method === 'GET' ? req.query : (req.body || {});
      const result = await handleShiftRequest(req.method, payload, accessToken, admin);
      res.status(result.status).json(result.data);
    } catch {
      res.status(503).json({ error: 'Server shift belum dikonfigurasi' });
    }
  });

  app.get('/api/public-catalog', async (req, res) => {
    try {
      const result = await getPublicCatalog(String(req.query.branchId || ''), getSupabaseAdmin());
      res.status(result.status).json(result.data);
    } catch {
      res.status(503).json({ error: 'Katalog self-order belum tersedia' });
    }
  });

  app.post('/api/self-order-token', async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const authorization = req.header('Authorization') || '';
      const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (!accessToken) { res.status(401).json({ error: 'Tidak terautentikasi' }); return; }
      const { data: { user } } = await admin.auth.getUser(accessToken);
      if (!user) { res.status(401).json({ error: 'Sesi tidak valid' }); return; }
      const { branchId, tableNumber, baseUrl } = req.body || {};
      if (!branchId || !tableNumber) { res.status(400).json({ error: 'branchId dan tableNumber wajib diisi' }); return; }
      const { data: table } = await admin.from('restaurant_tables').select('id,self_order_enabled').eq('branch_id', String(branchId)).eq('number', String(tableNumber)).maybeSingle();
      if (!table) { res.status(404).json({ error: `Meja ${tableNumber} tidak ditemukan` }); return; }
      if (!table.self_order_enabled) { res.status(403).json({ error: `Meja ${tableNumber} belum diaktifkan untuk self-order` }); return; }
      const secret = process.env.QR_TOKEN_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const token = await generateQrToken(String(branchId), String(tableNumber), secret);
      const url = buildSelfOrderUrl(String(baseUrl || `http://localhost:${PORT}`), String(branchId), String(tableNumber), token);
      res.json({ token, url, expiresInHours: 12 });
    } catch {
      res.status(503).json({ error: 'Server token belum dikonfigurasi' });
    }
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
