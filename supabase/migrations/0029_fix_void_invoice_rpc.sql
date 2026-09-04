-- Fix void_invoice RPC action status enum values

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

    -- Stop active collection actions (using valid enum values: skipped instead of cancelled)
    UPDATE public.collection_actions
    SET status = 'skipped'
    WHERE invoice_id = p_invoice_id AND status IN ('recommended', 'draft', 'approved');

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
