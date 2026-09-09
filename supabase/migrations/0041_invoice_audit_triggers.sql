-- Create a function to automatically log invoice creations and updates
CREATE OR REPLACE FUNCTION log_invoice_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    -- Try to get the authenticated user
    v_actor_id := auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            business_id, 
            actor_user_id, 
            event_type, 
            entity_type, 
            entity_id, 
            metadata
        ) VALUES (
            NEW.business_id,
            v_actor_id,
            'invoice_created',
            'invoice',
            NEW.id,
            jsonb_build_object(
                'invoice_number', NEW.invoice_number,
                'amount', NEW.total_amount,
                'currency', NEW.currency
            )
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if meaningful fields changed (to avoid spamming from background processes)
        IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
           NEW.due_date IS DISTINCT FROM OLD.due_date OR
           NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
            
            INSERT INTO audit_logs (
                business_id, 
                actor_user_id, 
                event_type, 
                entity_type, 
                entity_id, 
                metadata
            ) VALUES (
                NEW.business_id,
                v_actor_id,
                'invoice_edited',
                'invoice',
                NEW.id,
                jsonb_build_object(
                    'invoice_number', NEW.invoice_number,
                    'old_status', OLD.payment_status,
                    'new_status', NEW.payment_status
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_log_invoice_audit ON invoices;

-- Create the trigger
CREATE TRIGGER trg_log_invoice_audit
AFTER INSERT OR UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION log_invoice_audit_event();
