import { createClient } from '@supabase/supabase-js';
import { handlePinLogin } from '../../src/server/pinLogin';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serverKey) {
      return json({ error: 'Server autentikasi belum dikonfigurasi' }, 503);
    }

    const admin = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const body = await request.json().catch(() => ({}));
    const result = await handlePinLogin(body, admin);

    return json(result.data, result.status);
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
