import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const TENANT_ID = '00000000-0000-4000-a000-000000000001';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) throw new Error('Environment Supabase belum lengkap');

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profiles, error: profileError } = await admin
    .from('user_profiles')
    .select('user_id,avatar_public_id')
    .eq('tenant_id', TENANT_ID);
  if (profileError) throw profileError;

  const dummyProfileIds = (profiles || [])
    .filter((profile) => typeof profile.avatar_public_id === 'string' && /unsplash\.com|randomuser\.me|pravatar\.cc/i.test(profile.avatar_public_id))
    .map((profile) => profile.user_id);
  if (dummyProfileIds.length) {
    const { error } = await admin.from('user_profiles').update({ avatar_public_id: null }).in('user_id', dummyProfileIds);
    if (error) throw error;
  }

  const [{ count: menuCount }, { count: inventoryCount }, { data: configuration, error: configurationError }] = await Promise.all([
    admin.from('menu_items').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    admin.from('raw_materials').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    admin.from('tenant_config').select('attendance_config').eq('tenant_id', TENANT_ID).maybeSingle(),
  ]);
  if (configurationError) throw configurationError;
  console.log(JSON.stringify({ removedDummyAvatars: dummyProfileIds.length, menuCount, inventoryCount, attendance: configuration }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
