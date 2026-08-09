-- Seed: Initial tenant "Bakso Ujo" with 2 branches and tenant config.
-- Idempotent — uses deterministic UUIDs and ON CONFLICT DO NOTHING.
-- Menu items, raw materials, and condiments are NOT seeded (imported from Firebase).

begin;

-- Tenant
insert into public.tenants (id, name, slug)
values (
  '00000000-0000-4000-a000-000000000001'::uuid,
  'Bakso Ujo',
  'bakso-ujo'
) on conflict (id) do nothing;

-- Branch 1: Pasir Mulya (HQ)
insert into public.branches (id, tenant_id, code, name, address, phone)
values (
  '00000000-0000-4000-a000-000000000010'::uuid,
  '00000000-0000-4000-a000-000000000001'::uuid,
  'BGR-01',
  'Bakso Ujo - Pasirmulya Bogor',
  'Jl. Re. Abdullah No.7-9, RT.01/RW.07, Pasirmulya BOGOR BARAT',
  '089634627808'
) on conflict (id) do nothing;

-- Branch 2: Pasar Anyar
insert into public.branches (id, tenant_id, code, name, address, phone)
values (
  '00000000-0000-4000-a000-000000000020'::uuid,
  '00000000-0000-4000-a000-000000000001'::uuid,
  'BGR-02',
  'Bakso Ujo - Pasar Anyar',
  'Pasar Anyar, Bogor',
  ''
) on conflict (id) do nothing;

-- Tenant config (RestaurantProfile equivalent)
insert into public.tenant_config (
  tenant_id,
  display_name,
  tagline,
  address,
  phone,
  instagram,
  tiktok,
  logo_url,
  landing_page,
  kds_config,
  shift_config,
  attendance_config,
  finance_config
) values (
  '00000000-0000-4000-a000-000000000001'::uuid,
  'BAKSO UJO',
  'Nikmati Bakso Legendaris Sejak 2025',
  'Jl. Re. Abdullah No.7-9, RT.01/RW.07, Pasirmulya BOGOR BARAT',
  '6289634627808',
  'baksoujo__',
  'baksoujo',
  '',
  '{
    "promoBannerTitle": "FREE ICE CREAM ATAU ES TEH MANIS",
    "promoBannerDescription": "TUNJUKAN REVIEW GMAPS DIKASIR",
    "wallpaperBackgroundUrl": "",
    "googleReviewUrl": "https://www.google.com/search?q=bakso+ujo+bogor",
    "googleReviewText": "Bagikan pengalaman makanmu disini"
  }'::jsonb,
  '{
    "orderTimeLimitMinutes": 5,
    "soundNotificationsEnabled": true,
    "runningText": "JANGAN LUPA SHOLAT"
  }'::jsonb,
  '{
    "shiftScheduleKitchen": "07:00",
    "shiftScheduleCashier": "08:00",
    "shiftScheduleStaff": "09:00",
    "shiftScheduleAdmin": "08:00",
    "latenessToleranceMinutes": 5
  }'::jsonb,
  '{
    "gpsLatitude": -6.609013171412514,
    "gpsLongitude": 106.78293233420759,
    "gpsRadiusMeters": 20,
    "requireSelfiePhoto": true,
    "requireGpsActive": true,
    "isAttendanceEnabled": true,
    "isSelfOrderEnabled": true,
    "maxPinAttempts": 5,
    "pinLockoutMinutes": 5
  }'::jsonb,
  '{
    "taxRatePercent": 10,
    "isTaxEnabled": false,
    "serviceChargePercent": 0,
    "isServiceChargeEnabled": false,
    "isManualDiscountEnabled": true,
    "roundingMode": "TERDEKAT",
    "isRoundingEnabled": false
  }'::jsonb
) on conflict (tenant_id) do nothing;

commit;
