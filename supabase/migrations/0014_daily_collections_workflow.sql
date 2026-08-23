-- 0014_daily_collections_workflow.sql
-- Implements the daily collections workflow RPC and notification triggers

-- Function to run the daily automated checks
CREATE OR REPLACE FUNCTION run_daily_collections_workflow()
RETURNS void AS $$
DECLARE
    v_business RECORD;
    v_invoice RECORD;
    v_promise RECORD;
    v_new_stage collection_stage;
BEGIN
    -- 1. Mark missed promises
    FOR v_promise IN
        SELECT pp.*, i.customer_id, i.invoice_number
        FROM payment_promises pp
        JOIN invoices i ON i.id = pp.invoice_id
        WHERE pp.status = 'pending' AND pp.promised_date < CURRENT_DATE
    LOOP
        UPDATE payment_promises SET status = 'missed' WHERE id = v_promise.id;
        
        -- Create notification
        INSERT INTO notifications (business_id, user_id, type, title, message, entity_type, entity_id)
        SELECT v_promise.business_id, bm.user_id, 'promise_missed', 'Payment Promise Missed',
               'Missed payment promise for invoice ' || v_promise.invoice_number,
               'invoice', v_promise.invoice_id
        FROM business_members bm WHERE bm.business_id = v_promise.business_id AND bm.role IN ('owner', 'admin');
    END LOOP;

    -- 2. Update due/overdue state & stage for open invoices
    FOR v_invoice IN 
        SELECT * FROM invoices WHERE payment_status NOT IN ('paid', 'cancelled')
    LOOP
        v_new_stage := v_invoice.collection_stage;
        
        -- Determine stage based on Due-state rules
        IF EXISTS (SELECT 1 FROM payment_promises WHERE invoice_id = v_invoice.id AND status = 'missed') THEN
            v_new_stage := 'promise_missed';
        ELSIF EXISTS (SELECT 1 FROM payment_promises WHERE invoice_id = v_invoice.id AND status = 'pending') THEN
            v_new_stage := 'promise_pending';
        ELSIF v_invoice.risk_level IN ('high', 'critical') AND v_invoice.due_date < CURRENT_DATE - 15 THEN
            v_new_stage := 'escalated';
        ELSIF v_invoice.due_date < CURRENT_DATE THEN
            v_new_stage := 'overdue';
        ELSIF v_invoice.due_date <= CURRENT_DATE + 5 THEN
            v_new_stage := 'due_soon';
        ELSE
            v_new_stage := 'monitoring';
        END IF;

        IF v_new_stage != v_invoice.collection_stage THEN
            UPDATE invoices SET collection_stage = v_new_stage WHERE id = v_invoice.id;
            
            -- Notifications for due soon and overdue
            IF v_new_stage = 'due_soon' AND v_invoice.collection_stage = 'monitoring' THEN
                INSERT INTO notifications (business_id, user_id, type, title, message, entity_type, entity_id)
                SELECT v_invoice.business_id, bm.user_id, 'due_soon', 'Invoice Due Soon',
                       'Invoice ' || v_invoice.invoice_number || ' is due soon.',
                       'invoice', v_invoice.id
                FROM business_members bm WHERE bm.business_id = v_invoice.business_id;
            ELSIF v_new_stage = 'overdue' AND v_invoice.collection_stage != 'overdue' THEN
                INSERT INTO notifications (business_id, user_id, type, title, message, entity_type, entity_id)
                SELECT v_invoice.business_id, bm.user_id, 'overdue', 'Invoice Overdue',
                       'Invoice ' || v_invoice.invoice_number || ' is now overdue.',
                       'invoice', v_invoice.id
                FROM business_members bm WHERE bm.business_id = v_invoice.business_id;
            END IF;
        END IF;
    END LOOP;

    -- 3. Recommend collection actions
    FOR v_business IN SELECT id FROM businesses LOOP
        PERFORM recommend_collection_actions(v_business.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger to notify on risk level increases
CREATE OR REPLACE FUNCTION trigger_notify_risk_increase()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.risk_level IN ('high', 'critical') AND OLD.risk_level NOT IN ('high', 'critical') THEN
        INSERT INTO notifications (business_id, user_id, type, title, message, entity_type, entity_id)
        SELECT NEW.business_id, bm.user_id, 'risk_high', 'Risk Level Increased',
               'Invoice ' || NEW.invoice_number || ' risk level increased to ' || NEW.risk_level,
               'invoice', NEW.id
        FROM business_members bm WHERE bm.business_id = NEW.business_id AND bm.role IN ('owner', 'admin');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_risk_notify ON invoices;
CREATE TRIGGER on_invoice_risk_notify
AFTER UPDATE OF risk_level ON invoices
FOR EACH ROW
WHEN (OLD.risk_level IS DISTINCT FROM NEW.risk_level)
EXECUTE FUNCTION trigger_notify_risk_increase();


-- Trigger to notify on payment recorded
CREATE OR REPLACE FUNCTION trigger_notify_payment_recorded()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_number TEXT;
BEGIN
    SELECT invoice_number INTO v_invoice_number FROM invoices WHERE id = NEW.invoice_id;
    
    INSERT INTO notifications (business_id, user_id, type, title, message, entity_type, entity_id)
    SELECT NEW.business_id, bm.user_id, 'payment_recorded', 'Payment Recorded',
           'Payment of ' || NEW.amount || ' recorded for invoice ' || v_invoice_number,
           'payment', NEW.id
    FROM business_members bm WHERE bm.business_id = NEW.business_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_recorded_notify ON payments;
CREATE TRIGGER on_payment_recorded_notify
AFTER INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_payment_recorded();

