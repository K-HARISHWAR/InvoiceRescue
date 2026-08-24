-- 0017_fix_timeline_order_by.sql

-- Fixes the invalid UNION ORDER BY clause by using the correct column alias
-- matching the first SELECT statement, or positional ordering.

CREATE OR REPLACE FUNCTION get_invoice_timeline(p_invoice_id UUID)
RETURNS TABLE (
    id UUID,
    event_type TEXT,
    title TEXT,
    description TEXT,
    event_date TIMESTAMPTZ,
    amount NUMERIC,
    source_table TEXT,
    source_id UUID
) AS $$
BEGIN
    RETURN QUERY
    -- 1. Invoice Created
    SELECT 
        i.id,
        'invoice_issued'::TEXT AS event_type,
        'Invoice ' || i.invoice_number || ' issued' AS title,
        i.notes AS description,
        i.created_at AS event_date,
        i.total_amount AS amount,
        'invoices'::TEXT AS source_table,
        i.id AS source_id
    FROM invoices i WHERE i.id = p_invoice_id

    UNION ALL

    -- 2. Communications
    SELECT 
        c.id,
        CASE WHEN c.direction = 'outbound' THEN 'communication_sent' ELSE 'communication_received' END::TEXT,
        CASE WHEN c.direction = 'outbound' THEN 'Message sent: ' || COALESCE(c.subject, 'No Subject') ELSE 'Customer replied: ' || COALESCE(c.subject, 'No Subject') END,
        c.body_text,
        COALESCE(c.sent_at, c.received_at, c.created_at),
        NULL::NUMERIC,
        'communications'::TEXT,
        c.id
    FROM communications c WHERE c.invoice_id = p_invoice_id

    UNION ALL

    -- 3. Promises made
    SELECT 
        pp.id,
        'payment_promise'::TEXT,
        'Payment promised for ' || pp.promised_date,
        pp.reason,
        pp.created_at,
        pp.promised_amount,
        'payment_promises'::TEXT,
        pp.id
    FROM payment_promises pp WHERE pp.invoice_id = p_invoice_id

    UNION ALL

    -- 4. Promises missed
    SELECT 
        -- using a deterministic pseudo-id for the missed event based on the promise id
        pp.id,
        'promise_missed'::TEXT,
        'Payment promise missed',
        'Customer did not pay by ' || pp.promised_date,
        (pp.promised_date + interval '1 day')::TIMESTAMPTZ,
        pp.promised_amount,
        'payment_promises'::TEXT,
        pp.id
    FROM payment_promises pp WHERE pp.invoice_id = p_invoice_id AND pp.status = 'missed'

    UNION ALL

    -- 5. Payments
    SELECT 
        p.id,
        'payment_recorded'::TEXT,
        'Payment recorded',
        p.notes,
        p.paid_at,
        p.amount,
        'payments'::TEXT,
        p.id
    FROM payments p WHERE p.invoice_id = p_invoice_id

    UNION ALL

    -- 6. Collection Actions
    SELECT 
        ca.id,
        'collection_action'::TEXT,
        'Action executed: ' || replace(ca.action_type::TEXT, '_', ' '),
        ca.recommended_reason,
        COALESCE(ca.executed_at, ca.updated_at),
        NULL::NUMERIC,
        'collection_actions'::TEXT,
        ca.id
    FROM collection_actions ca WHERE ca.invoice_id = p_invoice_id AND ca.status IN ('sent', 'completed')

    ORDER BY event_date ASC;
END;
$$ LANGUAGE plpgsql;
