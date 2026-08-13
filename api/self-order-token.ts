import { createClient } from '@supabase/supabase-js';
import { handleTableSessionRequest } from '../src/server/tableSession';

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
  const admin = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const result = await handleTableSessionRequest(body, accessToken, admin);
  return json(result.data, result.status);
}
