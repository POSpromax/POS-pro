# Supabase setup

1. Create a new Supabase project in the same/nearest region as the Vercel
   Functions region.
2. Run migrations in filename order with the Supabase CLI or SQL editor.
3. Add only the project URL and publishable key to `VITE_*` variables.
4. Never expose a secret/service-role key in the browser.
5. Seed the first tenant, branch, Auth user, profile, and branch membership from
   a server-side/admin process.

The first migration intentionally covers only identity scope, branches, orders,
items, payments, media metadata, RLS, indexes, and branch-scoped Realtime. Stock,
shift, attendance, PIN authentication, void/refund, and audit ledgers will be
added as separate migrations so each workflow can be verified independently.
