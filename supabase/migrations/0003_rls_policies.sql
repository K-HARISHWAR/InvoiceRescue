-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_business_member(target_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM business_members
        WHERE business_id = target_business_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_business_role(target_business_id UUID, allowed_roles business_role[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM business_members
        WHERE business_id = target_business_id
        AND user_id = auth.uid()
        AND role = ANY(allowed_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- Businesses Policies
CREATE POLICY "Members can view business" ON businesses
    FOR SELECT USING (is_business_member(id));
CREATE POLICY "Authenticated users can create business" ON businesses
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Owner/Admin can update business" ON businesses
    FOR UPDATE USING (has_business_role(id, ARRAY['owner'::business_role, 'admin'::business_role]));
CREATE POLICY "Owner can delete business" ON businesses
    FOR DELETE USING (has_business_role(id, ARRAY['owner'::business_role]));

-- Business Members Policies
CREATE POLICY "Members can view members" ON business_members
    FOR SELECT USING (is_business_member(business_id));
CREATE POLICY "Owner/Admin can insert members" ON business_members
    FOR INSERT WITH CHECK (has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role]));
CREATE POLICY "Owner/Admin can update members" ON business_members
    FOR UPDATE USING (has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role]));
CREATE POLICY "Owner/Admin can delete members" ON business_members
    FOR DELETE USING (has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role]));
-- Add exception for user creating a business to add themselves as owner
CREATE POLICY "Users can add themselves as owner during creation" ON business_members
    FOR INSERT WITH CHECK (user_id = auth.uid() AND role = 'owner'::business_role);

-- Helper macro to generate standard policies for operational tables
-- Operational tables: customers, invoices, invoice_documents, payments, 
-- communications, payment_promises, collection_actions, risk_events, evidence_items

DO $$
DECLARE
    t_name TEXT;
BEGIN
    FOR t_name IN 
        SELECT unnest(ARRAY[
            'customers', 'invoices', 'invoice_documents', 'payments', 
            'communications', 'payment_promises', 'collection_actions', 
            'risk_events', 'evidence_items'
        ])
    LOOP
        EXECUTE format('
            CREATE POLICY "Members can view %I" ON %I FOR SELECT USING (is_business_member(business_id));
            CREATE POLICY "Members (not viewers) can insert %I" ON %I FOR INSERT WITH CHECK (has_business_role(business_id, ARRAY[''owner''::business_role, ''admin''::business_role, ''member''::business_role]));
            CREATE POLICY "Members (not viewers) can update %I" ON %I FOR UPDATE USING (has_business_role(business_id, ARRAY[''owner''::business_role, ''admin''::business_role, ''member''::business_role]));
            CREATE POLICY "Members (not viewers) can delete %I" ON %I FOR DELETE USING (has_business_role(business_id, ARRAY[''owner''::business_role, ''admin''::business_role, ''member''::business_role]));
        ', t_name, t_name, t_name, t_name, t_name, t_name, t_name, t_name);
    END LOOP;
END
$$;

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (user_id = auth.uid());

-- Audit Logs Policies
CREATE POLICY "Owner/Admin can view audit logs" ON audit_logs
    FOR SELECT USING (has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role]));
-- Audit logs should not be manually inserted/updated/deleted by clients
