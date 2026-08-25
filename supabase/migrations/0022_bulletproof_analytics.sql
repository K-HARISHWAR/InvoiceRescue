CREATE OR REPLACE FUNCTION get_expected_cash_inflow(target_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    WITH invoice_payments AS (
        SELECT invoice_id, MAX(paid_at) as last_payment_date
        FROM payments
        WHERE business_id = target_business_id
        GROUP BY invoice_id
    ),
    customer_stats AS (
        SELECT i.customer_id,
               COALESCE(AVG(GREATEST(0, EXTRACT(DAY FROM (ip.last_payment_date - i.due_date)))), 0)::INTEGER as avg_days_late
        FROM invoices i
        LEFT JOIN invoice_payments ip ON i.id = ip.invoice_id
        WHERE i.business_id = target_business_id AND i.payment_status = 'paid'
        GROUP BY i.customer_id
    ),
    expected_invoices AS (
        SELECT i.id, i.outstanding_amount,
               (i.due_date + (COALESCE(cs.avg_days_late, 0) || ' days')::INTERVAL)::TIMESTAMP as expected_date
        FROM invoices i
        LEFT JOIN customer_stats cs ON i.customer_id = cs.customer_id
        WHERE i.business_id = target_business_id AND i.payment_status IN ('open', 'partial', 'disputed') AND i.due_date IS NOT NULL
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'week_start', sub.week_start,
            'amount', sub.amount
        ) ORDER BY sub.week_start ASC
    ), '[]'::jsonb) INTO result
    FROM (
        SELECT DATE_TRUNC('week', expected_date)::DATE as week_start,
               SUM(outstanding_amount) as amount
        FROM expected_invoices
        WHERE DATE_TRUNC('week', expected_date) >= DATE_TRUNC('week', CURRENT_TIMESTAMP)
        GROUP BY DATE_TRUNC('week', expected_date)::DATE
        LIMIT 20
    ) sub;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_customer_payment_behaviour(target_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    WITH invoice_payments AS (
        SELECT invoice_id, MAX(paid_at) as last_payment_date
        FROM payments
        WHERE business_id = target_business_id
        GROUP BY invoice_id
    ),
    customer_stats AS (
        SELECT i.customer_id,
               COALESCE(AVG(EXTRACT(DAY FROM (ip.last_payment_date - i.due_date))), 0)::INTEGER as avg_days_late
        FROM invoices i
        LEFT JOIN invoice_payments ip ON i.id = ip.invoice_id
        WHERE i.business_id = target_business_id AND i.payment_status = 'paid' AND i.due_date IS NOT NULL
        GROUP BY i.customer_id
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'customer_name', sub.customer_name,
            'avg_days_late', sub.avg_days_late
        )
    ), '[]'::jsonb) INTO result
    FROM (
        SELECT COALESCE(c.company_name, c.name) as customer_name, 
               COALESCE(cs.avg_days_late, 0) as avg_days_late
        FROM customers c
        JOIN customer_stats cs ON c.id = cs.customer_id
        WHERE c.business_id = target_business_id
        ORDER BY cs.avg_days_late DESC
        LIMIT 10
    ) sub;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
