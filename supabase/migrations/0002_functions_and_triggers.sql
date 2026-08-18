-- 1. updated_at handling
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collection_actions_updated_at ON collection_actions;
CREATE TRIGGER update_collection_actions_updated_at
BEFORE UPDATE ON collection_actions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. profile creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users is created in a way that requires Supabase privileges.
-- Usually, we create it in the public schema and attach it to the auth schema table.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. payment recalculation
CREATE OR REPLACE FUNCTION recalculate_invoice_payments()
RETURNS TRIGGER AS $$
DECLARE
    target_invoice_id UUID;
    total_paid NUMERIC(12, 2);
    inv_total NUMERIC(12, 2);
    new_outstanding NUMERIC(12, 2);
    current_status payment_status;
    current_stage collection_stage;
    new_status payment_status;
    new_stage collection_stage;
BEGIN
    -- Determine which invoice to update based on operation
    IF TG_OP = 'DELETE' THEN
        target_invoice_id := OLD.invoice_id;
    ELSE
        target_invoice_id := NEW.invoice_id;
    END IF;

    -- Calculate total paid for this invoice
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments
    WHERE invoice_id = target_invoice_id;

    -- Get invoice current state
    SELECT total_amount, payment_status, collection_stage 
    INTO inv_total, current_status, current_stage
    FROM invoices
    WHERE id = target_invoice_id;

    -- Calculate new outstanding
    new_outstanding := GREATEST(inv_total - total_paid, 0);
    
    new_status := current_status;
    new_stage := current_stage;

    -- Determine new status and stage
    IF new_outstanding = 0 AND inv_total > 0 THEN
        new_status := 'paid'::payment_status;
        new_stage := 'closed'::collection_stage;
    ELSIF total_paid > 0 AND new_outstanding > 0 THEN
        IF current_status != 'paid'::payment_status THEN
            new_status := 'partial'::payment_status;
        END IF;
    ELSIF total_paid = 0 THEN
        -- Revert from partial/paid if payment deleted
        IF current_status IN ('partial'::payment_status, 'paid'::payment_status) THEN
            new_status := 'open'::payment_status;
            -- We might not know exactly what stage to revert to, default to monitoring if it was closed
            IF current_stage = 'closed'::collection_stage THEN
               new_stage := 'monitoring'::collection_stage;
            END IF;
        END IF;
    END IF;

    -- Update the invoice
    UPDATE invoices
    SET amount_paid = total_paid,
        outstanding_amount = new_outstanding,
        payment_status = new_status,
        collection_stage = new_stage
    WHERE id = target_invoice_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_changed ON payments;
CREATE TRIGGER on_payment_changed
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_payments();
