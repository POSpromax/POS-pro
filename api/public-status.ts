import { createClient } from '@supabase/supabase-js';
import { getPublicSelfOrderStatus } from '../src/server/publicSelfOrderStatus';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    // Snapshot kecil dibagi di edge per cabang. Checkout tetap selalu no-store
    // dan memvalidasi meja/stok langsung di database.
    'Cache-Control': 'public, max-age=3, s-maxage=5, stale-while-revalidate=10',
  },
});

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serverKey) return json({ error: 'Status self-order belum dikonfigurasi' }, 503);

  const params = new URL(request.url).searchParams;
  const admin = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await getPublicSelfOrderStatus(
    params.get('branchId') || '',
    admin,
    params.get('branchCode') || undefined,
  );
  return json(result.data, result.status);
}
