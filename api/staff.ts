import { createClient } from '@supabase/supabase-js';
import { handleStaffRequest } from '../src/server/staffManagement';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export default {
  async fetch(request: Request): Promise<Response> {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serverKey) return json({ error: 'Server staff belum dikonfigurasi' }, 503);
    const authorization = request.headers.get('Authorization') || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    const admin = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const result = await handleStaffRequest(request.method, body, accessToken, admin);
    return json(result.data, result.status);
  },
};
