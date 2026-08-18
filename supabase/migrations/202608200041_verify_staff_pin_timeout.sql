-- Login timeout (57014): verify_staff_pin memakai crypt() bcrypt (lambat) dan
-- lock baris auth-gate; di DB kecil / sedang berat, statement global (mis. 8s)
-- terlampaui. Beri fungsi login batas waktu lebih longgar (khusus fungsi ini),
-- karena login jarang dan wajib berhasil.

begin;

alter function public.verify_staff_pin(uuid, text, text, integer, integer)
  set statement_timeout = '20000';

commit;
