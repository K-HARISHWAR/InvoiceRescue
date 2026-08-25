CREATE OR REPLACE FUNCTION get_dashboard_metrics(target_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_outstanding NUMERIC(12,2) := 0;
    v_overdue NUMERIC(12,2) := 0;
    v_at_risk NUMERIC(12,2) := 0;
    v_collected_this_month NUMERIC(12,2) := 0;
    
    v_not_due NUMERIC(12,2) := 0;
    v_1_30 NUMERIC(12,2) := 0;
    v_31_60 NUMERIC(12,2) := 0;
    v_61_90 NUMERIC(12,2) := 0;
    v_90_plus NUMERIC(12,2) := 0;
    
    v_pipeline JSONB;
    
    -- New metrics
    v_open_invoice_count INTEGER := 0;
    v_paid_count INTEGER := 0;
    v_on_time_count INTEGER := 0;
    v_total_days_late INTEGER := 0;
    v_total_days_to_pay INTEGER := 0;
    v_average_days_to_pay INTEGER := 0;
    v_average_days_late INTEGER := 0;
    v_on_time_payment_rate NUMERIC := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(SUM(outstanding_amount), 0), COUNT(*) INTO v_outstanding, v_open_invoice_count
    FROM invoices
    WHERE business_id = target_business_id AND payment_status IN ('open', 'partial', 'disputed', 'draft');

    SELECT COALESCE(SUM(outstanding_amount), 0) INTO v_overdue
    FROM invoices
    WHERE business_id = target_business_id 
      AND payment_status IN ('open', 'partial', 'disputed')
      AND due_date < CURRENT_DATE;

    SELECT COALESCE(SUM(outstanding_amount), 0) INTO v_at_risk
    FROM invoices
    WHERE business_id = target_business_id 
      AND payment_status IN ('open', 'partial', 'disputed')
      AND risk_level IN ('high', 'critical');

    SELECT COALESCE(SUM(amount), 0) INTO v_collected_this_month
    FROM payments
    WHERE business_id = target_business_id
      AND DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', CURRENT_DATE);

    SELECT 
        COALESCE(SUM(outstanding_amount) FILTER (WHERE due_date >= CURRENT_DATE OR due_date IS NULL), 0),
        COALESCE(SUM(outstanding_amount) FILTER (WHERE due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30), 0),
        COALESCE(SUM(outstanding_amount) FILTER (WHERE due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60), 0),
        COALESCE(SUM(outstanding_amount) FILTER (WHERE due_date < CURRENT_DATE - 60 AND due_date >= CURRENT_DATE - 90), 0),
        COALESCE(SUM(outstanding_amount) FILTER (WHERE due_date < CURRENT_DATE - 90), 0)
    INTO v_not_due, v_1_30, v_31_60, v_61_90, v_90_plus
    FROM invoices
    WHERE business_id = target_business_id AND payment_status IN ('open', 'partial', 'disputed');

    SELECT COALESCE(jsonb_object_agg(stage, count), '{}'::jsonb)
    INTO v_pipeline
    FROM (
        SELECT collection_stage::TEXT as stage, COUNT(*) as count
        FROM invoices
        WHERE business_id = target_business_id AND payment_status IN ('open', 'partial', 'disputed')
        GROUP BY collection_stage
    ) sub;
    
    -- Calculate historical payment intelligence safely using CTE
    WITH invoice_payments AS (
        SELECT invoice_id, MAX(paid_at) as last_payment_date
        FROM payments
        WHERE business_id = target_business_id
        GROUP BY invoice_id
    )
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE i.due_date IS NULL OR ip.last_payment_date <= i.due_date),
           COALESCE(SUM(GREATEST(0, EXTRACT(DAY FROM (ip.last_payment_date - i.due_date)))), 0),
           COALESCE(SUM(GREATEST(0, EXTRACT(DAY FROM (ip.last_payment_date - i.invoice_date)))), 0)
    INTO v_paid_count, v_on_time_count, v_total_days_late, v_total_days_to_pay
    FROM invoices i
    LEFT JOIN invoice_payments ip ON i.id = ip.invoice_id
    WHERE i.business_id = target_business_id AND i.payment_status = 'paid';
    
    IF v_paid_count > 0 THEN
        v_on_time_payment_rate := (v_on_time_count::NUMERIC / v_paid_count::NUMERIC) * 100;
        v_average_days_late := v_total_days_late / v_paid_count;
        v_average_days_to_pay := v_total_days_to_pay / v_paid_count;
    END IF;
    
    result := jsonb_build_object(
        'metrics', jsonb_build_object(
            'outstanding', v_outstanding,
            'overdue', v_overdue,
            'atRisk', v_at_risk,
            'collectedThisMonth', v_collected_this_month,
            'averageDaysToPay', v_average_days_to_pay,
            'averageDaysLate', v_average_days_late,
            'onTimePaymentRate', v_on_time_payment_rate,
            'openInvoiceCount', v_open_invoice_count
        ),
        'aging', jsonb_build_object(
            'notDue', v_not_due,
            'days1_30', v_1_30,
            'days31_60', v_31_60,
            'days61_90', v_61_90,
            'days90Plus', v_90_plus
        ),
        'pipeline', v_pipeline
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_customer_intelligence(target_customer_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_total_invoices INTEGER := 0;
    v_total_paid NUMERIC(12,2) := 0;
    v_open_balance NUMERIC(12,2) := 0;
    v_average_days_late INTEGER := 0;
    v_on_time_rate NUMERIC := 0;
    v_missed_promises INTEGER := 0;
    v_paid_count INTEGER := 0;
    v_on_time_count INTEGER := 0;
    v_total_days_late INTEGER := 0;
    v_current_high_risk_invoices INTEGER := 0;
    v_recent_communication JSONB := NULL;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM customers c
        JOIN business_members bm ON bm.business_id = c.business_id
        WHERE c.id = target_customer_id AND bm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COUNT(*), COALESCE(SUM(outstanding_amount), 0), COUNT(*) FILTER (WHERE risk_level IN ('high', 'critical') AND payment_status IN ('open', 'partial', 'disputed'))
    INTO v_total_invoices, v_open_balance, v_current_high_risk_invoices
    FROM invoices
    WHERE customer_id = target_customer_id;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.customer_id = target_customer_id;

    SELECT COUNT(*)
    INTO v_missed_promises
    FROM payment_promises pp
    JOIN invoices i ON i.id = pp.invoice_id
    WHERE i.customer_id = target_customer_id AND pp.status = 'missed';

    WITH invoice_payments AS (
        SELECT p.invoice_id, MAX(p.paid_at) as last_payment_date
        FROM payments p
        JOIN invoices i ON i.id = p.invoice_id
        WHERE i.customer_id = target_customer_id
        GROUP BY p.invoice_id
    )
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE i.due_date IS NULL OR ip.last_payment_date <= i.due_date),
           COALESCE(SUM(GREATEST(0, EXTRACT(DAY FROM (ip.last_payment_date - i.due_date)))), 0)
    INTO v_paid_count, v_on_time_count, v_total_days_late
    FROM invoices i
    LEFT JOIN invoice_payments ip ON i.id = ip.invoice_id
    WHERE i.customer_id = target_customer_id AND i.payment_status = 'paid';

    IF v_paid_count > 0 THEN
        v_on_time_rate := (v_on_time_count::NUMERIC / v_paid_count::NUMERIC) * 100;
        v_average_days_late := v_total_days_late / v_paid_count;
    END IF;
    
    -- Recent communication
    SELECT jsonb_build_object(
        'id', id,
        'subject', subject,
        'created_at', created_at,
        'channel', channel,
        'direction', direction
    ) INTO v_recent_communication
    FROM communications
    WHERE customer_id = target_customer_id
    ORDER BY created_at DESC
    LIMIT 1;

    result := jsonb_build_object(
        'totalInvoices', v_total_invoices,
        'totalPaid', v_total_paid,
        'openBalance', v_open_balance,
        'averageDaysLate', v_average_days_late,
        'onTimeRate', v_on_time_rate,
        'missedPromises', v_missed_promises,
        'currentHighRiskInvoices', v_current_high_risk_invoices,
        'recentCommunication', v_recent_communication
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
