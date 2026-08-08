# Supabase setup

1. Create a Supabase project in the same/nearest region as Vercel Functions.
2. Run migrations in filename order with the Supabase CLI or SQL editor.
3. Migration `001` creates the cloud foundation. Migration `002` adds tenant
   consistency, hashed PIN credentials, devices, schedules, cashier shifts,
   attendance, self-order sessions, order events, and audit logs.
4. Add only the project URL and publishable key to `VITE_*` variables.
5. Never expose a secret/service-role key in the browser.
6. Seed the first tenant, branch, Auth user, profile, and branch membership from
   a server-side/admin process.

`set_staff_pin` and `verify_staff_pin` are executable only by `service_role`.
Never call them directly from the browser. The Vercel PIN endpoint verifies the
PIN server-side and exchanges a generated one-time token for a Supabase Auth
session. Direct anonymous writes to attendance, audit, credential, and
self-order-session tables are intentionally unavailable.

The UI data adapter has not yet been cut over from browser storage. Applying the
migrations alone does not make demo transactions persistent.
