-- 0018_analytics_and_intelligence.sql

-- 1. Update get_dashboard_metrics
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
    
    -- Calculate historical payment intelligence for global dashboard
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE i.due_date IS NULL OR (SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) <= i.due_date),
           COALESCE(SUM(GREATEST(0, EXTRACT(DAY FROM ((SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) - i.due_date)))), 0),
           COALESCE(SUM(GREATEST(0, EXTRACT(DAY FROM ((SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) - i.invoice_date)))), 0)
    INTO v_paid_count, v_on_time_count, v_total_days_late, v_total_days_to_pay
    FROM invoices i
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


-- 2. Update get_customer_intelligence
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

    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE i.due_date IS NULL OR (SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) <= i.due_date),
           COALESCE(SUM(GREATEST(0, EXTRACT(DAY FROM ((SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) - i.due_date)))), 0)
    INTO v_paid_count, v_on_time_count, v_total_days_late
    FROM invoices i
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


-- 3. Expected Cash Inflow RPC
CREATE OR REPLACE FUNCTION get_expected_cash_inflow(target_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    WITH customer_stats AS (
        SELECT i.customer_id,
               COALESCE(AVG(GREATEST(0, EXTRACT(DAY FROM ((SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) - i.due_date)))), 0)::INTEGER as avg_days_late
        FROM invoices i
        WHERE i.business_id = target_business_id AND i.payment_status = 'paid'
        GROUP BY i.customer_id
    ),
    expected_invoices AS (
        SELECT i.id, i.outstanding_amount,
               (i.due_date + COALESCE(cs.avg_days_late, 0) * INTERVAL '1 day')::DATE as expected_date
        FROM invoices i
        LEFT JOIN customer_stats cs ON i.customer_id = cs.customer_id
        WHERE i.business_id = target_business_id AND i.payment_status IN ('open', 'partial', 'disputed')
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'week_start', DATE_TRUNC('week', expected_date)::DATE,
            'amount', amount
        )
    ), '[]'::jsonb) INTO result
    FROM (
        SELECT DATE_TRUNC('week', expected_date)::DATE as week_start,
               SUM(outstanding_amount) as amount
        FROM expected_invoices
        WHERE expected_date >= DATE_TRUNC('week', CURRENT_DATE)::DATE
        GROUP BY DATE_TRUNC('week', expected_date)::DATE
        ORDER BY week_start ASC
        LIMIT 10
    ) aggregated;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Customer Payment Behaviour RPC
CREATE OR REPLACE FUNCTION get_customer_payment_behaviour(target_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'customer_name', COALESCE(c.company_name, c.name),
            'avg_days_late', COALESCE((
                SELECT AVG(EXTRACT(DAY FROM ((SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) - i.due_date)))
                FROM invoices i
                WHERE i.customer_id = c.id AND i.payment_status = 'paid'
            ), 0)::INTEGER
        )
    ), '[]'::jsonb) INTO result
    FROM customers c
    WHERE c.business_id = target_business_id
    ORDER BY (
        SELECT AVG(EXTRACT(DAY FROM ((SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) - i.due_date)))
        FROM invoices i
        WHERE i.customer_id = c.id AND i.payment_status = 'paid'
    ) DESC NULLS LAST
    LIMIT 10;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Collection Success RPC
CREATE OR REPLACE FUNCTION get_collection_success(target_business_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    v_after_reminder INTEGER := 0;
    v_after_promise INTEGER := 0;
    v_after_escalation INTEGER := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Invoices paid after reminder
    SELECT COUNT(DISTINCT i.id) INTO v_after_reminder
    FROM invoices i
    JOIN collection_actions ca ON i.id = ca.invoice_id
    WHERE i.business_id = target_business_id 
      AND i.payment_status = 'paid'
      AND ca.action_type IN ('friendly_reminder', 'due_date_reminder', 'overdue_reminder')
      AND ca.status = 'completed';

    -- Invoices paid after promise follow-up
    SELECT COUNT(DISTINCT i.id) INTO v_after_promise
    FROM invoices i
    JOIN collection_actions ca ON i.id = ca.invoice_id
    WHERE i.business_id = target_business_id 
      AND i.payment_status = 'paid'
      AND ca.action_type = 'promise_followup'
      AND ca.status = 'completed';

    -- Invoices paid after escalation
    SELECT COUNT(DISTINCT i.id) INTO v_after_escalation
    FROM invoices i
    JOIN collection_actions ca ON i.id = ca.invoice_id
    WHERE i.business_id = target_business_id 
      AND i.payment_status = 'paid'
      AND ca.action_type = 'escalation'
      AND ca.status = 'completed';

    result := jsonb_build_object(
        'afterReminder', v_after_reminder,
        'afterPromise', v_after_promise,
        'afterEscalation', v_after_escalation
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
