import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleBranchRequest(
  method: string,
  payload: Record<string, unknown>,
  accessToken: string,
  admin: SupabaseClient,
) {
  if (!accessToken) return { status: 401, data: { error: 'Tidak terautentikasi' } };
  const { data: { user } } = await admin.auth.getUser(accessToken);
  if (!user) return { status: 401, data: { error: 'Sesi tidak valid' } };
  const { data: profile } = await admin.from('user_profiles').select('tenant_id,is_active').eq('user_id', user.id).maybeSingle();
  if (!profile?.is_active || !profile.tenant_id) return { status: 403, data: { error: 'Profil tenant tidak aktif' } };

  const { data: memberships } = await admin.from('branch_members').select('branch_id,role,is_active').eq('user_id', user.id).eq('is_active', true);
  const allowedIds = (memberships || []).map((membership) => membership.branch_id);

  if (method === 'GET') {
    const query = admin.from('branches').select('id,code,name,address,phone,is_active').eq('tenant_id', profile.tenant_id).eq('is_active', true).order('name');
    const { data, error } = allowedIds.length ? await query.in('id', allowedIds) : { data: [], error: null };
    if (error) return { status: 500, data: { error: 'Daftar cabang gagal dibaca' } };
    return { status: 200, data: data || [] };
  }

  if (method !== 'POST') return { status: 405, data: { error: 'Method not allowed' } };
  if (!(memberships || []).some((membership) => ['SUPER_OWNER', 'OWNER'].includes(membership.role))) {
    return { status: 403, data: { error: 'Hanya Owner yang dapat membuat cabang' } };
  }
  const name = String(payload.name || '').trim();
  if (!name) return { status: 400, data: { error: 'Nama cabang wajib diisi' } };
  const codeBase = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'CABANG';
  const code = `${codeBase}-${Date.now().toString().slice(-5)}`;
  const { data: branch, error } = await admin.from('branches').insert({
    tenant_id: profile.tenant_id,
    code,
    name,
    address: String(payload.address || ''),
    phone: String(payload.phone || ''),
  }).select('id,code,name,address,phone,is_active').single();
  if (error) return { status: 500, data: { error: 'Cabang gagal dibuat di cloud' } };
  const ownerRole = (memberships || []).some((membership) => membership.role === 'SUPER_OWNER') ? 'SUPER_OWNER' : 'OWNER';
  await admin.from('branch_members').insert({ branch_id: branch.id, user_id: user.id, role: ownerRole, is_active: true });
  return { status: 201, data: branch };
}
