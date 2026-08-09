import 'dotenv/config';
import { getSupabaseAdmin } from '../src/server/supabaseAdmin';

const TENANT_ID = '00000000-0000-4000-a000-000000000001';
const BRANCH_IDS = [
  '00000000-0000-4000-a000-000000000010',
  '00000000-0000-4000-a000-000000000020',
];
const OWNER_EMAIL = 'ujobakso@gmail.com';
const OWNER_NAME = 'Gugun (Owner)';

async function main() {
  const admin = getSupabaseAdmin();
  const pin = process.env.OWNER_INITIAL_PIN;

  if (!pin || !/^\d{6}$/.test(pin)) {
    console.error('Set OWNER_INITIAL_PIN env var to a 6-digit PIN');
    process.exit(1);
  }

  // 1. Create or find Auth user
  const { data: listData, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  let userId = listData.users.find(
    (u: { email?: string }) => u.email === OWNER_EMAIL,
  )?.id as string | undefined;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('Created auth user:', userId);
  } else {
    console.log('Auth user already exists:', userId);
  }

  // 2. user_profiles
  const { error: profileError } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      tenant_id: TENANT_ID,
      display_name: OWNER_NAME,
      is_active: true,
    },
    { onConflict: 'user_id' },
  );
  if (profileError) throw profileError;
  console.log('user_profiles upserted');

  // 3. branch_members (both branches)
  for (const branchId of BRANCH_IDS) {
    const { error: memberError } = await admin.from('branch_members').upsert(
      {
        branch_id: branchId,
        user_id: userId,
        role: 'OWNER',
        permissions: {},
        is_active: true,
      },
      { onConflict: 'branch_id,user_id' },
    );
    if (memberError) throw memberError;
  }
  console.log('branch_members upserted for', BRANCH_IDS.length, 'branches');

  // 4. Set PIN
  const { error: pinError } = await admin.rpc('set_staff_pin', {
    target_user_id: userId,
    target_tenant_id: TENANT_ID,
    plain_pin: pin,
  });
  if (pinError) throw pinError;
  console.log('PIN set successfully');

  console.log('\nOwner setup complete for', OWNER_EMAIL);
}

main().catch((e) => {
  console.error('Setup failed:', e);
  process.exit(1);
});
