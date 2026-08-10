import { createClient } from '@supabase/supabase-js';
import { generateQrToken, buildSelfOrderUrl } from '../src/utils/qrToken';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serverKey) return json({ error: 'Server belum dikonfigurasi' }, 503);

  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return json({ error: 'Tidak terautentikasi' }, 401);

  const admin = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user } } = await admin.auth.getUser(accessToken);
  if (!user) return json({ error: 'Sesi tidak valid' }, 401);

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const branchId = String(body.branchId || '');
  const tableNumber = String(body.tableNumber || '');
  const baseUrl = String(body.baseUrl || 'https://pos-pro-eight.vercel.app');
  if (!branchId || !tableNumber) return json({ error: 'branchId dan tableNumber wajib diisi' }, 400);

  const { data: table } = await admin.from('restaurant_tables').select('id,self_order_enabled').eq('branch_id', branchId).eq('number', tableNumber).maybeSingle();
  if (!table) return json({ error: `Meja ${tableNumber} tidak ditemukan` }, 404);
  if (!table.self_order_enabled) return json({ error: `Meja ${tableNumber} belum diaktifkan untuk self-order` }, 403);

  const secret = process.env.QR_TOKEN_SECRET || serverKey;
  const token = await generateQrToken(branchId, tableNumber, secret);
  const url = buildSelfOrderUrl(baseUrl, branchId, tableNumber, token);
  return json({ token, url, expiresInHours: 12 });
}
