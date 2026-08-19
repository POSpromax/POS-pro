import { createClient } from '@supabase/supabase-js';
import { getPublicCatalog } from '../src/server/publicCatalog';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=120' },
});

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serverKey) return json({ error: 'Katalog self-order belum dikonfigurasi' }, 503);
  const params = new URL(request.url).searchParams;
  const branchId = params.get('branchId') || '';
  const tenantId = params.get('tenantId') || undefined;
  const branchCode = params.get('branchCode') || undefined;
  const admin = createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await getPublicCatalog(branchId, admin, tenantId, branchCode);
  return json(result.data, result.status);
}
