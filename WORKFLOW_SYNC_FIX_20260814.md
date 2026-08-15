# POS-PRO Order / Self-Order / Table Synchronization Fix

Date: 2026-08-14

## Single workflow invariant

- `restaurant_tables.self_order_enabled` is the only customer-order access switch.
- `READY + self_order_enabled=true + active_order_id=null` = customer may claim the table.
- `OCCUPIED + active_order_id=<order>` = an active bill owns the table; UI controls may not clear/disable it.
- `DISABLED + self_order_enabled=false + active_order_id=null` = table is closed for the next customer.
- A completed+paid or cancelled order automatically returns its table to DISABLED/OFF.

## Fixed

1. Removed the hidden branch-wide self-order gate from order submission/public catalog behavior.
2. Moved self-order idempotency lookup before table READY validation, so a network retry returns the original order instead of 409.
3. Public self-order error recovery no longer calls authenticated `listCloudOrders()` and therefore does not create a secondary 401.
4. `handleTableSessionUpdated()` now uses a functional React state update, preventing bulk/realtime updates from overwriting one another.
5. Table toggle/reset APIs protect `active_order_id` rather than trusting only visual status.
6. Table close lifecycle now sets both `status=DISABLED` and `self_order_enabled=false`.
7. Order table transfer A->B and DINE_IN->TAKE_AWAY releases the old table in the DB trigger.
8. Quick table active-order filtering now keeps COMPLETED-but-UNPAID bills active until payment is complete.
9. Occupied tables with an active bill no longer expose controls that are guaranteed to return 409.
10. Public ORDER_SUCCESS now polls only its own order UUID so NEW -> COOKING -> READY/COMPLETED is actually reflected on the customer phone.
11. Quick Table `LIHAT ORDER` / `PILIH ORDER` is wired into CashierView instead of silently doing nothing.

## Required database action

Apply migration:

`supabase/migrations/202608140024_order_table_workflow_consistency.sql`

Do this before considering the synchronization fix complete in production.
