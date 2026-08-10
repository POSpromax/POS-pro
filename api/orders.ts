import { createClient } from '@supabase/supabase-js';
import { handleOrderRequest } from '../src/server/orderManagement';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serverKey) return json({ error: 'Server pesanan belum dikonfigurasi' }, 503);
  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const payload = request.method === 'GET'
    ? Object.fromEntries(new URL(request.url).searchParams.entries())
    : await request.json().catch(() => ({}));
  const admin = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await handleOrderRequest(request.method, payload, accessToken, admin);
  return json(result.data, result.status);
}
