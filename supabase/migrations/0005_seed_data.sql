-- Seed Data for InvoiceRescue Demo
-- NOTE: Please ensure you have created at least one user in Supabase Auth before running this script.

DO $$
DECLARE
    demo_user_id UUID;
    demo_business_id UUID := '11111111-1111-1111-1111-111111111111';
    c1_id UUID := '22222222-2222-2222-2222-222222222221';
    c2_id UUID := '22222222-2222-2222-2222-222222222222';
    c3_id UUID := '22222222-2222-2222-2222-222222222223';
    c4_id UUID := '22222222-2222-2222-2222-222222222224';
    c5_id UUID := '22222222-2222-2222-2222-222222222225';
    
    inv_c3_1 UUID := '33333333-3333-3333-3333-333333333331';
    inv_c4_1 UUID := '33333333-3333-3333-3333-333333333332';
    inv_c5_1 UUID := '33333333-3333-3333-3333-333333333333';
    
    comm_id UUID := '44444444-4444-4444-4444-444444444441';
BEGIN
    -- Grab the first user
    SELECT id INTO demo_user_id FROM auth.users LIMIT 1;
    
    IF demo_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found in auth.users. Please create a user via Supabase Auth first.';
    END IF;

    -- 1. Create Business
    INSERT INTO businesses (id, owner_user_id, name, legal_name, default_currency)
    VALUES (demo_business_id, demo_user_id, 'Demo Enterprise', 'Demo Enterprise Pvt Ltd', 'INR')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Add as Owner
    INSERT INTO business_members (business_id, user_id, role)
    VALUES (demo_business_id, demo_user_id, 'owner')
    ON CONFLICT (business_id, user_id) DO NOTHING;

    -- 3. Create Customers
    INSERT INTO customers (id, business_id, name, company_name, primary_email) VALUES
    (c1_id, demo_business_id, 'Reliable Co', 'Reliable Co Ltd', 'finance@reliable.com'),
    (c2_id, demo_business_id, 'Slightly Late LLC', 'Slightly Late LLC', 'ap@slightlylate.com'),
    (c3_id, demo_business_id, 'Promise Breaker Inc', 'Promise Breaker Inc', 'billing@promisebreaker.com'),
    (c4_id, demo_business_id, 'Silent Customer', 'Silent Customer Ltd', 'admin@silent.com'),
    (c5_id, demo_business_id, 'ABC Enterprises', 'ABC Enterprises', 'payables@abcent.com')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Create Invoices
    -- Reliable Co (Paid)
    INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, payment_status, collection_stage, created_by)
    VALUES (demo_business_id, c1_id, 'INV-1001', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '10 days', 50000, 9000, 59000, 'paid', 'closed', demo_user_id);
    
    -- Slightly Late (Open, due soon)
    INSERT INTO invoices (business_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, payment_status, collection_stage, created_by)
    VALUES (demo_business_id, c2_id, 'INV-1002', CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '5 days', 100000, 18000, 118000, 'open', 'due_soon', demo_user_id);

    -- Promise Breaker (Overdue, high risk)
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, payment_status, collection_stage, risk_score, risk_level, created_by)
    VALUES (inv_c3_1, demo_business_id, c3_id, 'INV-1003', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '30 days', 75000, 13500, 88500, 'open', 'promise_missed', 75, 'high', demo_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- Silent Customer (Overdue, critical risk)
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, payment_status, collection_stage, risk_score, risk_level, created_by)
    VALUES (inv_c4_1, demo_business_id, c4_id, 'INV-1004', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '60 days', 200000, 36000, 236000, 'open', 'escalated', 90, 'critical', demo_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- Disputed (Disputed state)
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, payment_status, collection_stage, risk_score, risk_level, created_by)
    VALUES (inv_c5_1, demo_business_id, c5_id, 'INV-1043', '2026-08-17', '2026-09-16', 200000, 40000, 240000, 'disputed', 'escalated', 82, 'critical', demo_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- 5. Add Payments for Reliable Co
    -- We can get the invoice_id we just inserted
    INSERT INTO payments (business_id, invoice_id, amount, paid_at, recorded_by)
    SELECT demo_business_id, id, 59000, CURRENT_DATE - INTERVAL '15 days', demo_user_id
    FROM invoices WHERE invoice_number = 'INV-1001';

    -- 6. Add Communications and Promises
    -- Promise Breaker
    INSERT INTO communications (id, business_id, customer_id, invoice_id, channel, direction, subject, body_text, category, sent_at)
    VALUES (comm_id, demo_business_id, c3_id, inv_c3_1, 'email', 'inbound', 'Re: Overdue Invoice INV-1003', 'We will definitely pay this by next Friday.', 'payment_promise', CURRENT_DATE - INTERVAL '10 days')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO payment_promises (business_id, invoice_id, communication_id, promised_date, status)
    VALUES (demo_business_id, inv_c3_1, comm_id, CURRENT_DATE - INTERVAL '3 days', 'missed');

    -- Disputed (ABC Enterprises hackathon scenario)
    INSERT INTO communications (business_id, customer_id, invoice_id, channel, direction, subject, body_text, category, sent_at)
    VALUES (demo_business_id, c5_id, inv_c5_1, 'email', 'outbound', 'Invoice INV-1043 is overdue', 'Please pay immediately.', 'general', CURRENT_DATE - INTERVAL '24 days');
    
    INSERT INTO risk_events (business_id, invoice_id, previous_score, new_score, risk_level, reasons)
    VALUES (demo_business_id, inv_c5_1, 67, 82, 'critical', '[{"code": "DISPUTED", "points": 15, "description": "Customer requested supporting documents"}]'::jsonb);

END $$;
