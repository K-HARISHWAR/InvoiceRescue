-- Risk engine calculation function
CREATE OR REPLACE FUNCTION calculate_invoice_risk(target_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
    inv RECORD;
    score INTEGER := 10;
    days_overdue INTEGER := 0;
    missed_promises_count INTEGER := 0;
    promise_penalty INTEGER := 0;
    no_response_penalty INTEGER := 0;
    dispute_penalty INTEGER := 0;
    customer_paid_count INTEGER := 0;
    customer_on_time_count INTEGER := 0;
    on_time_rate NUMERIC;
    customer_history_adj INTEGER := 0;
    final_score INTEGER;
    calculated_level risk_level;
    reasons JSONB := '[]'::jsonb;
    prev_score INTEGER;
BEGIN
    -- Get invoice details
    SELECT * INTO inv FROM invoices WHERE id = target_invoice_id;
    
    IF inv.id IS NULL THEN
        RETURN;
    END IF;

    IF inv.payment_status = 'paid' OR inv.payment_status = 'cancelled' THEN
        -- Do not recalculate for closed invoices, but ensure it's recorded if we need it
        RETURN;
    END IF;
    
    prev_score := inv.risk_score;

    -- 1. Overdue calculation
    IF inv.due_date IS NOT NULL AND inv.due_date < CURRENT_DATE THEN
        days_overdue := CURRENT_DATE - inv.due_date;
        IF days_overdue >= 46 THEN
            score := score + 40;
            reasons := reasons || jsonb_build_object('code', 'OVERDUE_46_PLUS', 'points', 40, 'description', 'Invoice is 46+ days overdue.');
        ELSIF days_overdue >= 31 THEN
            score := score + 30;
            reasons := reasons || jsonb_build_object('code', 'OVERDUE_31_45', 'points', 30, 'description', 'Invoice is 31-45 days overdue.');
        ELSIF days_overdue >= 8 THEN
            score := score + 20;
            reasons := reasons || jsonb_build_object('code', 'OVERDUE_8_30', 'points', 20, 'description', 'Invoice is 8-30 days overdue.');
        ELSIF days_overdue >= 1 THEN
            score := score + 10;
            reasons := reasons || jsonb_build_object('code', 'OVERDUE_1_7', 'points', 10, 'description', 'Invoice is 1-7 days overdue.');
        END IF;
    ELSE
        reasons := reasons || jsonb_build_object('code', 'NOT_OVERDUE', 'points', 0, 'description', 'Invoice is not overdue.');
    END IF;

    -- 2. Missed promises
    SELECT COUNT(*) INTO missed_promises_count 
    FROM payment_promises 
    WHERE invoice_id = target_invoice_id AND status = 'missed';
    
    IF missed_promises_count > 0 THEN
        promise_penalty := LEAST(missed_promises_count * 15, 30);
        score := score + promise_penalty;
        reasons := reasons || jsonb_build_object('code', 'MISSED_PROMISES', 'points', promise_penalty, 'description', missed_promises_count || ' missed payment promise(s).');
    END IF;

    -- 3. No response for >= 7 days after collection email
    IF EXISTS (
        SELECT 1 
        FROM communications outbound
        WHERE outbound.invoice_id = target_invoice_id 
          AND outbound.direction = 'outbound'
          AND outbound.created_at <= NOW() - INTERVAL '7 days'
          AND NOT EXISTS (
              SELECT 1 
              FROM communications inbound
              WHERE inbound.invoice_id = target_invoice_id 
                AND inbound.direction = 'inbound'
                AND inbound.created_at > outbound.created_at
          )
    ) THEN
        no_response_penalty := 10;
        score := score + no_response_penalty;
        reasons := reasons || jsonb_build_object('code', 'NO_RESPONSE_7_DAYS', 'points', 10, 'description', 'No response for 7+ days after collection communication.');
    END IF;

    -- 4. Open invoice dispute
    IF EXISTS (
        SELECT 1 FROM communications 
        WHERE invoice_id = target_invoice_id AND category = 'dispute'
    ) THEN
        dispute_penalty := 15;
        score := score + dispute_penalty;
        reasons := reasons || jsonb_build_object('code', 'OPEN_DISPUTE', 'points', 15, 'description', 'Invoice has an active dispute.');
    END IF;

    -- 5. Customer History
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE i.due_date IS NULL OR (SELECT MAX(paid_at) FROM payments p WHERE p.invoice_id = i.id) <= i.due_date)
    INTO customer_paid_count, customer_on_time_count
    FROM invoices i
    WHERE i.customer_id = inv.customer_id AND i.payment_status = 'paid' AND i.id != target_invoice_id;

    IF customer_paid_count >= 3 THEN
        on_time_rate := (customer_on_time_count::NUMERIC / customer_paid_count::NUMERIC);
        IF on_time_rate < 0.50 THEN
            customer_history_adj := 10;
            score := score + customer_history_adj;
            reasons := reasons || jsonb_build_object('code', 'POOR_PAYER_HISTORY', 'points', 10, 'description', 'Customer pays on time less than 50% of the time.');
        ELSIF on_time_rate > 0.80 THEN
            customer_history_adj := -10;
            score := score + customer_history_adj;
            reasons := reasons || jsonb_build_object('code', 'GOOD_PAYER_HISTORY', 'points', -10, 'description', 'Customer pays on time more than 80% of the time.');
        END IF;
    END IF;

    -- Final Score & Level
    final_score := GREATEST(0, LEAST(100, score));
    
    IF final_score <= 29 THEN calculated_level := 'low';
    ELSIF final_score <= 59 THEN calculated_level := 'medium';
    ELSIF final_score <= 79 THEN calculated_level := 'high';
    ELSE calculated_level := 'critical';
    END IF;

    -- Update invoice if changed
    IF prev_score IS DISTINCT FROM final_score OR prev_score IS NULL THEN
        UPDATE invoices 
        SET risk_score = final_score, 
            risk_level = calculated_level 
        WHERE id = target_invoice_id;
        
        -- Insert risk event
        INSERT INTO risk_events (business_id, invoice_id, previous_score, new_score, risk_level, reasons)
        VALUES (inv.business_id, target_invoice_id, prev_score, final_score, calculated_level, reasons);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Triggers for recalculation
CREATE OR REPLACE FUNCTION trigger_recalculate_risk()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'invoices' THEN
        IF TG_OP = 'UPDATE' THEN
           PERFORM calculate_invoice_risk(NEW.id);
        END IF;
        RETURN NEW;
    ELSIF TG_TABLE_NAME = 'payment_promises' THEN
        PERFORM calculate_invoice_risk(NEW.invoice_id);
        RETURN NEW;
    ELSIF TG_TABLE_NAME = 'communications' THEN
        IF NEW.invoice_id IS NOT NULL THEN
            PERFORM calculate_invoice_risk(NEW.invoice_id);
        END IF;
        RETURN NEW;
    ELSIF TG_TABLE_NAME = 'payments' THEN
        PERFORM calculate_invoice_risk(NEW.invoice_id);
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_invoice_risk_update ON invoices;
CREATE TRIGGER on_invoice_risk_update
AFTER UPDATE OF due_date, payment_status ON invoices
FOR EACH ROW
WHEN (OLD.due_date IS DISTINCT FROM NEW.due_date OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
EXECUTE FUNCTION trigger_recalculate_risk();

DROP TRIGGER IF EXISTS on_promise_risk_update ON payment_promises;
CREATE TRIGGER on_promise_risk_update
AFTER INSERT OR UPDATE OF status ON payment_promises
FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_risk();

DROP TRIGGER IF EXISTS on_communication_risk_update ON communications;
CREATE TRIGGER on_communication_risk_update
AFTER INSERT ON communications
FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_risk();


-- Dashboard Metrics RPC
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
BEGIN
    -- Check permissions using the helper if it exists, but for now we trust the client auth or apply RLS implicitly if possible.
    -- Since it's SECURITY DEFINER, we should probably check if auth.uid() is a member.
    IF NOT EXISTS (SELECT 1 FROM business_members WHERE business_id = target_business_id AND user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(SUM(outstanding_amount), 0) INTO v_outstanding
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
    
    result := jsonb_build_object(
        'metrics', jsonb_build_object(
            'outstanding', v_outstanding,
            'overdue', v_overdue,
            'atRisk', v_at_risk,
            'collectedThisMonth', v_collected_this_month
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

-- Customer Intelligence RPC
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
BEGIN
    -- Check permissions
    IF NOT EXISTS (
        SELECT 1 FROM customers c
        JOIN business_members bm ON bm.business_id = c.business_id
        WHERE c.id = target_customer_id AND bm.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Total invoices and open balance
    SELECT COUNT(*), COALESCE(SUM(outstanding_amount), 0)
    INTO v_total_invoices, v_open_balance
    FROM invoices
    WHERE customer_id = target_customer_id;

    -- Total paid (amount)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.customer_id = target_customer_id;

    -- Missed promises
    SELECT COUNT(*)
    INTO v_missed_promises
    FROM payment_promises pp
    JOIN invoices i ON i.id = pp.invoice_id
    WHERE i.customer_id = target_customer_id AND pp.status = 'missed';

    -- Historical payment metrics
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

    result := jsonb_build_object(
        'totalInvoices', v_total_invoices,
        'totalPaid', v_total_paid,
        'openBalance', v_open_balance,
        'averageDaysLate', v_average_days_late,
        'onTimeRate', v_on_time_rate,
        'missedPromises', v_missed_promises
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
