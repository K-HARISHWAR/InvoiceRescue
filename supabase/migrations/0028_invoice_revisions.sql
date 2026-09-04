-- Phase 17: Professional Invoice Editing & Version History

-- 1. Safely add 'void' to payment_status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'payment_status' AND e.enumlabel = 'void'
    ) THEN
        ALTER TYPE payment_status ADD VALUE 'void';
    END IF;
END
$$;

-- 2. Add version to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 3. Create invoice_revisions table
CREATE TABLE IF NOT EXISTS public.invoice_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    entity_id UUID REFERENCES public.business_entities(id) ON DELETE CASCADE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    revision_number INT NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    change_reason TEXT,
    before_data JSONB NOT NULL,
    after_data JSONB NOT NULL,
    changed_fields JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.invoice_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revisions of their businesses" ON public.invoice_revisions
    FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY "Finance managers and above can create revisions" ON public.invoice_revisions
    FOR INSERT WITH CHECK (
        public.has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role, 'finance_manager'::business_role])
    );

-- 5. RPC for updating invoice with versioning and revision tracking
CREATE OR REPLACE FUNCTION public.update_invoice_with_revision(
    p_invoice_id UUID,
    p_updates JSONB,
    p_expected_version INT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_business_id UUID;
    v_entity_id UUID;
    v_new_version INT;
    v_before_data JSONB;
    v_after_data JSONB;
    v_changed_fields JSONB;
    v_new_outstanding NUMERIC(12, 2);
    v_new_total NUMERIC(12, 2);
    v_amount_paid NUMERIC(12, 2);
BEGIN
    -- 1. Check permissions
    SELECT business_id, entity_id, version, payment_status, total_amount, amount_paid 
    INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found.';
    END IF;

    v_business_id := v_invoice.business_id;
    v_entity_id := v_invoice.entity_id;

    IF NOT public.has_business_role(v_business_id, ARRAY['owner'::business_role, 'admin'::business_role, 'finance_manager'::business_role]) THEN
        RAISE EXCEPTION 'Permission denied: Must be Finance Manager or above to edit invoices.';
    END IF;

    -- 2. Check optimistic concurrency
    IF v_invoice.version != p_expected_version THEN
        RAISE EXCEPTION 'CONCURRENCY_ERROR: This invoice was updated by another user while you were editing it.';
    END IF;

    -- 3. Enforce lifecycle rules
    IF v_invoice.payment_status IN ('paid', 'cancelled', 'void') AND (p_updates ? 'total_amount' OR p_updates ? 'currency' OR p_updates ? 'subtotal' OR p_updates ? 'tax_amount') THEN
         RAISE EXCEPTION 'Cannot modify financial fields of a % invoice.', v_invoice.payment_status;
    END IF;

    IF v_invoice.payment_status NOT IN ('draft') AND (p_reason IS NULL OR TRIM(p_reason) = '') THEN
        RAISE EXCEPTION 'Reason for change is required for non-draft invoices.';
    END IF;

    -- Calculate new outstanding if total is changed
    IF p_updates ? 'total_amount' THEN
        v_new_total := (p_updates->>'total_amount')::NUMERIC(12, 2);
        v_amount_paid := v_invoice.amount_paid;
        
        IF v_new_total < v_amount_paid THEN
            RAISE EXCEPTION 'Total amount cannot be less than the amount already paid.';
        END IF;

        v_new_outstanding := GREATEST(v_new_total - v_amount_paid, 0);
        p_updates := p_updates || jsonb_build_object('outstanding_amount', v_new_outstanding);
    END IF;

    -- 4. Get before snapshot
    SELECT to_jsonb(i.*) INTO v_before_data
    FROM public.invoices i
    WHERE id = p_invoice_id;

    -- Clean the updates object to only include fields that actually exist in the table and changed
    -- (Simplified diff generation for the RPC)
    SELECT jsonb_object_agg(key, value) INTO v_changed_fields
    FROM jsonb_each(p_updates)
    WHERE p_updates->>key IS DISTINCT FROM v_before_data->>key
      AND key NOT IN ('id', 'business_id', 'created_at', 'updated_at', 'version');

    IF v_changed_fields IS NULL THEN
        -- No changes detected
        RETURN v_before_data;
    END IF;

    -- 5. Perform the update
    v_new_version := v_invoice.version + 1;
    
    -- Dynamically update using JSONB
    UPDATE public.invoices
    SET 
        customer_id = COALESCE((v_changed_fields->>'customer_id')::UUID, customer_id),
        entity_id = COALESCE((v_changed_fields->>'entity_id')::UUID, entity_id),
        invoice_number = COALESCE(v_changed_fields->>'invoice_number', invoice_number),
        invoice_date = COALESCE((v_changed_fields->>'invoice_date')::DATE, invoice_date),
        due_date = CASE WHEN v_changed_fields ? 'due_date' THEN (v_changed_fields->>'due_date')::DATE ELSE due_date END,
        payment_terms_days = CASE WHEN v_changed_fields ? 'payment_terms_days' THEN (v_changed_fields->>'payment_terms_days')::INT ELSE payment_terms_days END,
        currency = COALESCE(v_changed_fields->>'currency', currency),
        subtotal = COALESCE((v_changed_fields->>'subtotal')::NUMERIC(12, 2), subtotal),
        tax_amount = COALESCE((v_changed_fields->>'tax_amount')::NUMERIC(12, 2), tax_amount),
        total_amount = COALESCE((v_changed_fields->>'total_amount')::NUMERIC(12, 2), total_amount),
        outstanding_amount = COALESCE((v_changed_fields->>'outstanding_amount')::NUMERIC(12, 2), outstanding_amount),
        notes = CASE WHEN v_changed_fields ? 'notes' THEN v_changed_fields->>'notes' ELSE notes END,
        version = v_new_version,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 6. Get after snapshot
    SELECT to_jsonb(i.*) INTO v_after_data
    FROM public.invoices i
    WHERE id = p_invoice_id;

    -- 7. Insert revision
    IF v_invoice.payment_status != 'draft' THEN
        INSERT INTO public.invoice_revisions (
            business_id,
            entity_id,
            invoice_id,
            revision_number,
            changed_by,
            change_reason,
            before_data,
            after_data,
            changed_fields
        ) VALUES (
            v_business_id,
            v_entity_id,
            p_invoice_id,
            v_new_version,
            auth.uid(),
            p_reason,
            v_before_data,
            v_after_data,
            v_changed_fields
        );
    END IF;

    RETURN v_after_data;
END;
$$;

-- 6. RPC for safely voiding an invoice
CREATE OR REPLACE FUNCTION public.void_invoice(
    p_invoice_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_business_id UUID;
    v_before_data JSONB;
    v_after_data JSONB;
    v_new_version INT;
BEGIN
    -- 1. Check permissions
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found.';
    END IF;

    v_business_id := v_invoice.business_id;

    IF NOT public.has_business_role(v_business_id, ARRAY['owner'::business_role, 'admin'::business_role, 'finance_manager'::business_role]) THEN
        RAISE EXCEPTION 'Permission denied: Must be Finance Manager or above to void invoices.';
    END IF;

    IF v_invoice.payment_status = 'void' THEN
        RAISE EXCEPTION 'Invoice is already voided.';
    END IF;
    
    IF v_invoice.payment_status = 'paid' THEN
        RAISE EXCEPTION 'Cannot void a paid invoice.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Reason for voiding is required.';
    END IF;

    -- 2. Snapshot
    SELECT to_jsonb(v_invoice.*) INTO v_before_data;
    v_new_version := v_invoice.version + 1;

    -- 3. Update invoice
    UPDATE public.invoices
    SET 
        payment_status = 'void',
        collection_stage = 'closed',
        outstanding_amount = 0,
        version = v_new_version,
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- Stop active collection actions
    UPDATE public.collection_actions
    SET status = 'cancelled'
    WHERE invoice_id = p_invoice_id AND status IN ('recommended', 'draft', 'approved', 'scheduled');

    -- Cancel active promises
    UPDATE public.payment_promises
    SET status = 'cancelled'
    WHERE invoice_id = p_invoice_id AND status = 'pending';

    -- 4. After snapshot
    SELECT to_jsonb(i.*) INTO v_after_data
    FROM public.invoices i
    WHERE id = p_invoice_id;

    -- 5. Insert revision
    INSERT INTO public.invoice_revisions (
        business_id,
        entity_id,
        invoice_id,
        revision_number,
        changed_by,
        change_reason,
        before_data,
        after_data,
        changed_fields
    ) VALUES (
        v_business_id,
        v_invoice.entity_id,
        p_invoice_id,
        v_new_version,
        auth.uid(),
        'Voided: ' || p_reason,
        v_before_data,
        v_after_data,
        jsonb_build_object(
            'payment_status', 'void', 
            'collection_stage', 'closed', 
            'outstanding_amount', 0
        )
    );

    RETURN v_after_data;
END;
$$;
