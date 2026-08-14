import type { RestaurantProfile } from '../types/pos';
import { getSupabase } from '../lib/supabase';

export type TenantBrandConfig = Pick<RestaurantProfile, 'name' | 'logoUrl' | 'instagram' | 'tiktok'>;

type AttendanceConfig = Pick<RestaurantProfile,
  | 'gpsLatitude'
  | 'gpsLongitude'
  | 'gpsRadiusMeters'
  | 'requireSelfiePhoto'
  | 'requireGpsActive'
  | 'isAttendanceEnabled'
  | 'shiftScheduleKitchen'
  | 'shiftScheduleCashier'
  | 'shiftScheduleStaff'
  | 'shiftScheduleAdmin'
  | 'latenessToleranceMinutes'
>;

async function tenantContext() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi telah berakhir');
  const { data, error } = await supabase.from('user_profiles').select('tenant_id').eq('user_id', user.id).single();
  if (error || !data?.tenant_id) throw new Error('Tenant akun tidak ditemukan');
  return { supabase, tenantId: data.tenant_id as string };
}

export async function getCloudTenantBrand(): Promise<Partial<TenantBrandConfig>> {
  const { supabase, tenantId } = await tenantContext();
  const { data, error } = await supabase
    .from('tenant_config')
    .select('display_name,logo_url,instagram,tiktok')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? {
    name: data.display_name || '',
    logoUrl: data.logo_url || '',
    instagram: data.instagram || '',
    tiktok: data.tiktok || '',
  } : {};
}

/**
 * Loads the effective attendance policy for one branch. Tenant values provide
 * defaults while profile_overrides owns physical-outlet differences such as
 * GPS coordinates and schedules.
 */
export async function getCloudAttendanceConfig(branchId: string): Promise<Partial<AttendanceConfig>> {
  const { supabase, tenantId } = await tenantContext();
  const [{ data: tenant, error: tenantError }, { data: branch, error: branchError }] = await Promise.all([
    supabase
      .from('tenant_config')
      .select('attendance_config,shift_config')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('branch_operational_config')
      .select('profile_overrides')
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .maybeSingle(),
  ]);
  if (tenantError) throw new Error(tenantError.message);
  if (branchError && branchError.code !== '42P01' && branchError.code !== 'PGRST205') {
    throw new Error(branchError.message);
  }
  return {
    ...((tenant?.shift_config || {}) as Partial<AttendanceConfig>),
    ...((tenant?.attendance_config || {}) as Partial<AttendanceConfig>),
    ...((branch?.profile_overrides || {}) as Partial<AttendanceConfig>),
  };
}

export async function saveCloudTenantBrand(config: TenantBrandConfig): Promise<void> {
  const { supabase, tenantId } = await tenantContext();
  const { error } = await supabase.from('tenant_config').upsert({
    tenant_id: tenantId,
    display_name: config.name.trim(),
    logo_url: config.logoUrl.trim() || null,
    instagram: config.instagram.trim() || null,
    tiktok: config.tiktok.trim() || null,
  }, { onConflict: 'tenant_id' });
  if (error) throw new Error(error.message);
}
