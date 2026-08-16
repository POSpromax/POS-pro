-- Migration 202608160028: finalize_order_payment
-- Purpose: Implement immutable order snapshot + idempotent payment
-- Contract:
--   - Lock order FOR UPDATE
--   - Reject CANCELLED orders
--   - Idempotent if already PAID
--   - Total authoritative from orders.total_amount
--   - Validate payment method
--   - CASH: paid_amount >= total_amount
--   - Calculate change server-side
--   - Update ONLY payment_status/payment_method/paid_amount/change_amount/
--     paid_shift_id/cashier attribution
--   - Upsert payments one row per order
--   - Call deduct_order_inventory (already idempotent)
--   - DO NOT update order_items
--   - DO NOT query/validate condiment
--   - DO NOT recompute price/subtotal/tax/discount
--   - DO NOT auto-complete kitchen

-- ============================================================================
-- RPC: finalize_order_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION finalize_order_payment(
  p_order_id UUID,
  p_branch_id UUID,
  p_payment_method TEXT,
  p_paid_amount BIGINT,
  p_paid_shift_id UUID,
  p_cashier_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_order RECORD;
  v_change BIGINT;
  v_result JSONB;
  v_existing_payment RECORD;
BEGIN
  -- Validate inputs
  IF p_order_id IS NULL OR p_branch_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Order ID dan Branch ID wajib diisi'
    );
  END IF;

  IF p_payment_method NOT IN ('CASH', 'QRIS', 'DEBIT', 'TRANSFER') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Metode pembayaran tidak valid'
    );
  END IF;

  -- Lock order FOR UPDATE to prevent concurrent modifications
  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
    AND branch_id = p_branch_id
  FOR UPDATE;

  -- Order not found
  IF v_order IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Pesanan tidak ditemukan'
    );
  END IF;

  -- Reject CANCELLED orders
  IF v_order.status = 'CANCELLED' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Pesanan sudah dibatalkan'
    );
  END IF;

  -- Idempotency: if already PAID, return success with existing payment
  IF v_order.payment_status = 'PAID' THEN
    SELECT *
    INTO v_existing_payment
    FROM payments
    WHERE order_id = p_order_id
    LIMIT 1;

    IF v_existing_payment IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', TRUE,
        'idempotent', TRUE,
        'message', 'Pesanan sudah dibayar sebelumnya',
        'payment_id', v_existing_payment.id,
        'paid_amount', v_existing_payment.paid_amount,
        'change_amount', v_existing_payment.change_amount
      );
    END IF;
  END IF;

  -- CASH validation: paid_amount >= total_amount
  IF p_payment_method = 'CASH' THEN
    IF p_paid_amount < v_order.total_amount THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'error', 'Jumlah uang tunai kurang'
      );
    END IF;
  END IF;

  -- Calculate change (server-side only)
  v_change := p_paid_amount - v_order.total_amount;
  IF v_change < 0 THEN
    v_change := 0;
  END IF;

  -- Update order: ONLY payment fields
  UPDATE orders
  SET
    payment_status = 'PAID',
    payment_method = p_payment_method,
    paid_amount = p_paid_amount,
    change_amount = v_change,
    paid_shift_id = p_paid_shift_id,
    updated_at = NOW()
  WHERE id = p_order_id
    AND branch_id = p_branch_id;

  -- Upsert payment: one row per order (idempotent on order_id)
  INSERT INTO payments (
    order_id,
    branch_id,
    method,
    amount,
    paid_amount,
    change_amount,
    processed_by,
    shift_id,
    created_at
  )
  VALUES (
    p_order_id,
    p_branch_id,
    p_payment_method,
    v_order.total_amount,
    p_paid_amount,
    v_change,
    p_cashier_user_id,
    p_paid_shift_id,
    NOW()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    method = EXCLUDED.method,
    paid_amount = EXCLUDED.paid_amount,
    change_amount = EXCLUDED.change_amount,
    processed_by = COALESCE(EXCLUDED.processed_by, payments.processed_by),
    updated_at = NOW();

  -- Call deduct_order_inventory (already idempotent by internal logic)
  -- This function handles idempotency via inventory_movement_requests
  PERFORM deduct_order_inventory(p_order_id, p_branch_id);

  -- Success response
  v_result := jsonb_build_object(
    'success', TRUE,
    'order_id', p_order_id,
    'payment_status', 'PAID',
    'payment_method', p_payment_method,
    'total_amount', v_order.total_amount,
    'paid_amount', p_paid_amount,
    'change_amount', v_change
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$;

-- Grant execution to authenticated users and anon
GRANT EXECUTE ON FUNCTION finalize_order_payment(UUID, UUID, TEXT, BIGINT, UUID, UUID) TO authenticated, anon;

-- ============================================================================
-- Ensure payments table has ON CONFLICT support (if needed)
-- ============================================================================
-- The payments table must have a unique constraint on order_id for the
-- ON CONFLICT clause to work. If it doesn't exist, add it:

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'payments'
      AND indexname = 'payments_order_id_key'
  ) THEN
    ALTER TABLE payments
    ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);
  END IF;
END $$;

-- ============================================================================
-- Migration note
-- ============================================================================
-- Status: PENDING
-- Applied: NO
-- 
-- This migration:
-- 1. Creates finalize_order_payment RPC (security definer, safe search_path)
-- 2. Immutably locks order and validates branch
-- 3. Rejects CANCELLED orders
-- 4. Returns success if already PAID (idempotent)
-- 5. Validates cash payment (paid_amount >= total)
-- 6. Calculates change server-side
-- 7. Updates ONLY payment fields (immutable item snapshot)
-- 8. Upserts single payment row per order
-- 9. Calls existing deduct_order_inventory (idempotent)
-- 10. Never mutates order_items, modifiers, or kitchen_status
--
-- This ensures:
-- - Order snapshot is immutable after creation
-- - Historical order can be paid despite config changes
-- - Double-click/retry produces single payment
-- - Stock deducted only once per payment
-- - Audit trail preserved
