-- Edit ayat jurnal (ganti header + baris secara atomik, jaga debit=kredit).
-- Hapus jurnal & kelola bagan akun dilakukan server (service role) tanpa RPC.

begin;

create or replace function public.update_journal_entry(
  p_entry_id uuid,
  p_branch_id uuid,
  p_entry_date date,
  p_reference text,
  p_description text,
  p_lines jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_total_debit numeric(16,2) := 0;
  v_total_credit numeric(16,2) := 0;
  v_line jsonb;
  v_account_id uuid;
  v_debit numeric(16,2);
  v_credit numeric(16,2);
  v_line_count int := 0;
begin
  select tenant_id into v_tenant_id
  from public.journal_entries
  where id = p_entry_id and branch_id = p_branch_id;
  if v_tenant_id is null then
    raise exception 'Jurnal tidak ditemukan';
  end if;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_debit := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    if v_debit < 0 or v_credit < 0 then raise exception 'Nominal tidak boleh negatif'; end if;
    if v_debit > 0 and v_credit > 0 then raise exception 'Satu baris tidak boleh debit dan kredit sekaligus'; end if;
    if v_debit = 0 and v_credit = 0 then continue; end if;
    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count < 2 then raise exception 'Jurnal minimal 2 baris (ada sisi debit dan kredit)'; end if;
  if v_total_debit <> v_total_credit then
    raise exception 'Jurnal tidak seimbang: total debit % tidak sama dengan total kredit %', v_total_debit, v_total_credit;
  end if;

  update public.journal_entries
    set entry_date = p_entry_date,
        reference = nullif(p_reference, ''),
        description = coalesce(p_description, '')
  where id = p_entry_id;

  delete from public.journal_lines where entry_id = p_entry_id;

  for v_line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    v_debit := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    if v_debit = 0 and v_credit = 0 then continue; end if;
    select id into v_account_id from public.chart_of_accounts
      where branch_id = p_branch_id and code = (v_line->>'code') limit 1;
    if v_account_id is null then
      raise exception 'Akun dengan kode % tidak ditemukan di outlet ini', (v_line->>'code');
    end if;
    insert into public.journal_lines
      (tenant_id, branch_id, entry_id, account_id, account_code, debit, credit, memo, entry_date)
    values
      (v_tenant_id, p_branch_id, p_entry_id, v_account_id, (v_line->>'code'),
       v_debit, v_credit, nullif(v_line->>'memo', ''), p_entry_date);
  end loop;

  return p_entry_id;
end;
$$;

revoke all on function public.update_journal_entry(uuid, uuid, date, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_journal_entry(uuid, uuid, date, text, text, jsonb) to service_role;

commit;
