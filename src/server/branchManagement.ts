import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidateAuthorizationForUser, READ_AUTHORIZATION_CACHE_TTL_MS, resolveTenantActor } from './requestAuthorization';

export async function handleBranchRequest(
  method: string,
  payload: Record<string, unknown>,
  accessToken: string,
  admin: SupabaseClient,
) {
  const actor = await resolveTenantActor(
    admin,
    accessToken,
    method === 'GET' ? READ_AUTHORIZATION_CACHE_TTL_MS : 0,
  );
  if (!actor) return { status: 401, data: { error: 'Sesi tidak valid' } };
  const profile = { tenant_id: actor.tenantId };
  const memberships = actor.memberships;
  const allowedIds = memberships.map((membership) => membership.branch_id);

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

  // Cabang baru harus langsung memiliki membership dan konfigurasi operasional.
  // Migration 017 hanya membackfill cabang yang sudah ada ketika SQL dijalankan;
  // tanpa inisialisasi ini cabang yang dibuat kemudian tidak dapat menyimpan URL
  // Self-order, profil outlet, atau scope topping.
  const { error: memberError } = await admin.from('branch_members').insert({
    branch_id: branch.id,
    user_id: actor.userId,
    role: ownerRole,
    is_active: true,
  });
  if (memberError) {
    await admin.from('branches').delete().eq('id', branch.id);
    return { status: 500, data: { error: 'Cabang gagal dihubungkan ke akun Owner' } };
  }

  const { data: routeRows, error: routeReadError } = await admin
    .from('branch_operational_config')
    // Slug dipakai sebagai rute publik tanpa tenant di URL dan index database
    // bersifat global, jadi ketersediaannya juga wajib dicek lintas tenant.
    .select('public_order_slug');
  if (routeReadError) {
    await admin.from('branches').delete().eq('id', branch.id);
    return { status: 500, data: { error: 'Konfigurasi cabang belum siap. Pastikan seluruh migration sudah diterapkan.' } };
  }
  const usedRoutes = new Set((routeRows || []).map((row) => String(row.public_order_slug || '')).filter(Boolean));
  let publicOrderSlug = '';
  for (let candidate = 1; candidate <= 9999; candidate += 1) {
    const value = String(candidate).padStart(2, '0');
    if (!usedRoutes.has(value)) {
      publicOrderSlug = value;
      break;
    }
  }
  if (!publicOrderSlug) {
    await admin.from('branches').delete().eq('id', branch.id);
    return { status: 409, data: { error: 'Kode URL Self-order cabang sudah habis' } };
  }

  const { error: configError } = await admin.from('branch_operational_config').insert({
    branch_id: branch.id,
    tenant_id: profile.tenant_id,
    self_order_enabled: true,
    public_order_slug: publicOrderSlug,
    profile_overrides: {
      address: String(payload.address || ''),
      phone: String(payload.phone || ''),
    },
    condiment_scopes: {},
  });
  if (configError) {
    await admin.from('branches').delete().eq('id', branch.id);
    return { status: 500, data: { error: 'Konfigurasi operasional cabang gagal dibuat' } };
  }
  // The current Owner received a new membership, so a cached branch list must
  // not hide the newly created outlet until its normal TTL expires.
  invalidateAuthorizationForUser(actor.userId);
  return { status: 201, data: branch };
}
