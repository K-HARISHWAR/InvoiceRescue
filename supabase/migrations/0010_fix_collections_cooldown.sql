-- Fixes the Collections Engine RPC to properly respect the cooldown for skipped actions

CREATE OR REPLACE FUNCTION recommend_collection_actions(p_business_id UUID)
RETURNS void AS $$
DECLARE
    v_invoice RECORD;
    v_action_type action_type;
    v_reason TEXT;
    v_recent_action_count INTEGER;
BEGIN
    FOR v_invoice IN 
        SELECT i.*, 
               (SELECT COUNT(*) FROM payment_promises pp WHERE pp.invoice_id = i.id AND pp.status = 'missed') as missed_promises_count,
               (SELECT COUNT(*) FROM communications c WHERE c.invoice_id = i.id AND c.category IN ('dispute', 'document_request') AND c.created_at > (NOW() - INTERVAL '7 days')) as recent_disputes_count
        FROM invoices i
        WHERE i.business_id = p_business_id 
          AND i.payment_status NOT IN ('paid', 'cancelled')
          AND i.collection_stage NOT IN ('closed', 'recovery_ready')
    LOOP
        v_action_type := NULL;
        v_reason := NULL;
        
        -- Check for existing open actions (recommended, draft, approved)
        SELECT COUNT(*) INTO v_recent_action_count
        FROM collection_actions
        WHERE invoice_id = v_invoice.id 
          AND status IN ('recommended', 'draft', 'approved');
          
        IF v_recent_action_count > 0 THEN
            CONTINUE; -- Skip if already has an open action
        END IF;

        -- Check cooldown (e.g., action sent or skipped within last 5 days)
        SELECT COUNT(*) INTO v_recent_action_count
        FROM collection_actions
        WHERE invoice_id = v_invoice.id
          AND status IN ('sent', 'skipped')
          AND updated_at > (NOW() - INTERVAL '5 days');
          
        IF v_recent_action_count > 0 THEN
            CONTINUE; -- Cooldown period active, skip
        END IF;

        -- Priority Rules
        -- 1. Document Request (Dispute)
        IF v_invoice.payment_status = 'disputed' OR v_invoice.recent_disputes_count > 0 THEN
            v_action_type := 'document_request';
            v_reason := 'Invoice is marked as disputed or customer requested documentation recently.';
            
        -- 2. Escalation (High Risk or Multiple Missed Promises)
        ELSIF v_invoice.missed_promises_count >= 2 OR v_invoice.risk_level IN ('high', 'critical') THEN
            v_action_type := 'escalation';
            v_reason := 'Account shows high risk or multiple missed payment promises.';
            
        -- 3. Promise Follow-up
        ELSIF v_invoice.missed_promises_count = 1 THEN
            v_action_type := 'promise_followup';
            v_reason := 'Customer missed a promised payment date.';
            
        -- 4. Overdue Reminder
        ELSIF v_invoice.due_date < CURRENT_DATE THEN
            v_action_type := 'overdue_reminder';
            v_reason := 'Invoice is overdue.';
            
        -- 5. Friendly Reminder (Due within 5 days)
        ELSIF v_invoice.due_date <= (CURRENT_DATE + 5) AND v_invoice.due_date >= CURRENT_DATE THEN
            v_action_type := 'friendly_reminder';
            v_reason := 'Invoice is due soon.';
        END IF;

        IF v_action_type IS NOT NULL THEN
            INSERT INTO collection_actions (
                business_id,
                invoice_id,
                action_type,
                status,
                recommended_reason
            ) VALUES (
                p_business_id,
                v_invoice.id,
                v_action_type,
                'recommended',
                v_reason
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
