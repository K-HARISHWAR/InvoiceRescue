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

    -- 5. Customer History (FIXED: Subqueries removed from aggregates)
    WITH invoice_payments AS (
        SELECT invoice_id, MAX(paid_at) as last_payment_date
        FROM payments
        WHERE invoice_id IN (
            SELECT id FROM invoices 
            WHERE customer_id = inv.customer_id AND payment_status = 'paid' AND id != target_invoice_id
        )
        GROUP BY invoice_id
    )
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE i.due_date IS NULL OR ip.last_payment_date <= i.due_date)
    INTO customer_paid_count, customer_on_time_count
    FROM invoices i
    LEFT JOIN invoice_payments ip ON i.id = ip.invoice_id
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
