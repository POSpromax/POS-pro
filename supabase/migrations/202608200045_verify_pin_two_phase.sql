-- KOREKSI migrasi 044: ORDER BY yang ditambahkan di sana MEMAKSA Postgres
-- mengevaluasi crypt() pada SEMUA baris sebelum mengurutkan, sehingga login
-- selalu membayar 11x bcrypt (~27 dtk) -> melewati batas gateway (504).
-- Tanpa ORDER BY, LIMIT 1 berhenti pada baris pertama yang cocok.
--
-- Strategi dua fase (keduanya early-terminate):
--   Fase 1: cocokkan hanya hash cost 10 (murah). Akun yang sudah ter-migrasi
--           selesai sangat cepat tanpa menyentuh hash cost 12.
--   Fase 2: bila belum ketemu, cocokkan hash lama (cost 12) dengan early exit.
-- Setiap login sukses me-rehash ke cost 10, sehingga fase 2 makin menyusut dan
-- akhirnya semua login hanya lewat fase 1.

begin;

create or replace function public.verify_staff_pin(
  p_branch_id uuid,
  p_pin text,
  p_device_hash text,
  p_max_attempts integer default 5,
  p_lock_minutes integer default 5
)
returns table (
  success boolean,
  matched_user_id uuid,
  matched_tenant_id uuid,
  display_name text,
  matched_role text,
  permissions jsonb,
  locked_until timestamptz,
  remaining_attempts integer
)
language plpgsql
security definer
set search_path = public, extensions
set statement_timeout = '60000'
as $$
declare
  branch_tenant uuid;
  gate_attempts integer;
  gate_locked_until timestamptz;
  found_user uuid;
  found_name text;
  found_role text;
  found_permissions jsonb;
  found_legacy boolean := false;
  max_gate integer := greatest(3, least(p_max_attempts, 10));
begin
  if p_pin !~ '^[0-9]{6}$' or p_device_hash !~ '^[0-9a-f]{64}$' then
    return query select false, null::uuid, null::uuid, null::text, null::text,
      null::jsonb, null::timestamptz, 0;
    return;
  end if;

  select b.tenant_id into branch_tenant
  from public.branches b
  where b.id = p_branch_id and b.is_active;
  if branch_tenant is null then
    return query select false, null::uuid, null::uuid, null::text, null::text,
      null::jsonb, null::timestamptz, 0;
    return;
  end if;

  insert into public.terminal_auth_gates (branch_id, device_fingerprint_hash)
  values (p_branch_id, p_device_hash)
  on conflict do nothing;

  select g.failed_attempts, g.locked_until
    into gate_attempts, gate_locked_until
  from public.terminal_auth_gates g
  where g.branch_id = p_branch_id and g.device_fingerprint_hash = p_device_hash;

  if gate_locked_until is not null and gate_locked_until > now() then
    return query select false, null::uuid, branch_tenant, null::text, null::text,
      null::jsonb, gate_locked_until, 0;
    return;
  end if;

  -- FASE 1: hash murah (cost 10) — TANPA ORDER BY agar berhenti di baris cocok.
  select sc.user_id, p.display_name, bm.role, bm.permissions
    into found_user, found_name, found_role, found_permissions
  from public.staff_credentials sc
  join public.user_profiles p on p.user_id = sc.user_id and p.tenant_id = sc.tenant_id
  join public.branch_members bm on bm.user_id = sc.user_id and bm.branch_id = p_branch_id
  where sc.tenant_id = branch_tenant
    and p.is_active and bm.is_active
    and (sc.locked_until is null or sc.locked_until <= now())
    and sc.pin_hash like '$2a$10$%'
    and crypt(p_pin, sc.pin_hash) = sc.pin_hash
  limit 1;

  -- FASE 2: hash lama (cost tinggi), hanya bila fase 1 tidak ketemu.
  if found_user is null then
    select sc.user_id, p.display_name, bm.role, bm.permissions
      into found_user, found_name, found_role, found_permissions
    from public.staff_credentials sc
    join public.user_profiles p on p.user_id = sc.user_id and p.tenant_id = sc.tenant_id
    join public.branch_members bm on bm.user_id = sc.user_id and bm.branch_id = p_branch_id
    where sc.tenant_id = branch_tenant
      and p.is_active and bm.is_active
      and (sc.locked_until is null or sc.locked_until <= now())
      and sc.pin_hash like '$2%'
      and sc.pin_hash not like '$2a$10$%'
      and crypt(p_pin, sc.pin_hash) = sc.pin_hash
    limit 1;
    if found_user is not null then
      found_legacy := true;
    end if;
  end if;

  if found_user is null then
    update public.terminal_auth_gates g
      set failed_attempts = g.failed_attempts + 1,
          locked_until = case
            when g.failed_attempts + 1 >= max_gate
            then now() + make_interval(mins => greatest(1, least(p_lock_minutes, 60)))
            else null
          end,
          updated_at = now()
    where g.branch_id = p_branch_id and g.device_fingerprint_hash = p_device_hash
    returning g.failed_attempts, g.locked_until into gate_attempts, gate_locked_until;

    insert into public.audit_events (tenant_id, branch_id, action, target_type, metadata)
    values (branch_tenant, p_branch_id, 'AUTH_PIN_FAILED', 'TERMINAL',
      jsonb_build_object('locked', gate_locked_until is not null));
    return query select false, null::uuid, branch_tenant, null::text, null::text,
      null::jsonb, gate_locked_until, greatest(0, max_gate - gate_attempts);
    return;
  end if;

  update public.terminal_auth_gates g
    set failed_attempts = 0, locked_until = null, updated_at = now()
  where g.branch_id = p_branch_id and g.device_fingerprint_hash = p_device_hash;

  -- Self-heal: hash lama -> turunkan ke cost 10 supaya login berikutnya lewat fase 1.
  if found_legacy then
    update public.staff_credentials
      set pin_hash = crypt(p_pin, gen_salt('bf', 10)),
          failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
    where user_id = found_user;
  else
    update public.staff_credentials
      set failed_attempts = 0, locked_until = null, last_login_at = now(), updated_at = now()
    where user_id = found_user;
  end if;

  insert into public.audit_events (tenant_id, branch_id, actor_user_id, action, target_type, target_id)
  values (branch_tenant, p_branch_id, found_user, 'AUTH_PIN_SUCCEEDED', 'USER', found_user::text);

  return query select true, found_user, branch_tenant, found_name, found_role,
    coalesce(found_permissions, '{}'::jsonb), null::timestamptz, max_gate;
end;
$$;

revoke all on function public.verify_staff_pin(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.verify_staff_pin(uuid, text, text, integer, integer) to service_role;

commit;
