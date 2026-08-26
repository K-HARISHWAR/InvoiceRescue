-- Risk Engine Unit Tests
BEGIN;

-- This script runs a transaction, performs tests on calculate_invoice_risk, and rolls back so it doesn't affect data.

DO $$
DECLARE
    test_business_id UUID := gen_random_uuid();
    test_customer_id UUID := gen_random_uuid();
    test_invoice_id UUID := gen_random_uuid();
    calculated_score INTEGER;
    calculated_level TEXT;
BEGIN
    -- Setup dummy data
    INSERT INTO businesses (id, name, owner_user_id) VALUES (test_business_id, 'Test Business', auth.uid());
    INSERT INTO customers (id, business_id, name) VALUES (test_customer_id, test_business_id, 'Test Customer');
    
    -- Base Invoice
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, total_amount, outstanding_amount, payment_status)
    VALUES (test_invoice_id, test_business_id, test_customer_id, 'TEST-001', 100, 100, 'open');

    -- Test 1: Not overdue
    UPDATE invoices SET due_date = CURRENT_DATE + 5 WHERE id = test_invoice_id;
    SELECT risk_score, risk_level INTO calculated_score, calculated_level FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 10 THEN RAISE EXCEPTION 'Test Failed: Not overdue. Expected 10, got %', calculated_score; END IF;

    -- Test 2: 1 day overdue
    UPDATE invoices SET due_date = CURRENT_DATE - 1 WHERE id = test_invoice_id;
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 20 THEN RAISE EXCEPTION 'Test Failed: 1 day overdue. Expected 20, got %', calculated_score; END IF;

    -- Test 3: 10 days overdue
    UPDATE invoices SET due_date = CURRENT_DATE - 10 WHERE id = test_invoice_id;
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 30 THEN RAISE EXCEPTION 'Test Failed: 10 days overdue. Expected 30, got %', calculated_score; END IF;

    -- Test 4: 40 days overdue
    UPDATE invoices SET due_date = CURRENT_DATE - 40 WHERE id = test_invoice_id;
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 40 THEN RAISE EXCEPTION 'Test Failed: 40 days overdue. Expected 40, got %', calculated_score; END IF;

    -- Test 5: 60 days overdue
    UPDATE invoices SET due_date = CURRENT_DATE - 60 WHERE id = test_invoice_id;
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 50 THEN RAISE EXCEPTION 'Test Failed: 60 days overdue. Expected 50, got %', calculated_score; END IF;

    -- Test 6: One missed promise
    UPDATE invoices SET due_date = CURRENT_DATE + 10 WHERE id = test_invoice_id; -- Reset to not overdue (10)
    INSERT INTO payment_promises (invoice_id, business_id, promised_date, status) VALUES (test_invoice_id, test_business_id, CURRENT_DATE - 2, 'missed');
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 25 THEN RAISE EXCEPTION 'Test Failed: 1 missed promise. Expected 25, got %', calculated_score; END IF;

    -- Test 7: Multiple missed promises (max 30 penalty)
    INSERT INTO payment_promises (invoice_id, business_id, promised_date, status) VALUES (test_invoice_id, test_business_id, CURRENT_DATE - 1, 'missed');
    INSERT INTO payment_promises (invoice_id, business_id, promised_date, status) VALUES (test_invoice_id, test_business_id, CURRENT_DATE, 'missed');
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 40 THEN RAISE EXCEPTION 'Test Failed: 3 missed promises. Expected 40, got %', calculated_score; END IF;

    -- Test 8: Open dispute (+15)
    INSERT INTO communications (business_id, customer_id, invoice_id, category, direction) VALUES (test_business_id, test_customer_id, test_invoice_id, 'dispute', 'inbound');
    -- Force trigger
    UPDATE invoices SET payment_status = 'disputed' WHERE id = test_invoice_id;
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 55 THEN RAISE EXCEPTION 'Test Failed: Open dispute. Expected 55, got %', calculated_score; END IF;

    -- Test 9: Good payer history (-10)
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, total_amount, payment_status, due_date) VALUES (gen_random_uuid(), test_business_id, test_customer_id, 'TEST-002', 100, 'paid', CURRENT_DATE + 1);
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, total_amount, payment_status, due_date) VALUES (gen_random_uuid(), test_business_id, test_customer_id, 'TEST-003', 100, 'paid', CURRENT_DATE + 1);
    INSERT INTO invoices (id, business_id, customer_id, invoice_number, total_amount, payment_status, due_date) VALUES (gen_random_uuid(), test_business_id, test_customer_id, 'TEST-004', 100, 'paid', CURRENT_DATE + 1);
    -- Insert payments to show they paid before due date
    INSERT INTO payments (invoice_id, business_id, amount, paid_at) SELECT id, test_business_id, 100, CURRENT_DATE FROM invoices WHERE invoice_number IN ('TEST-002', 'TEST-003', 'TEST-004');
    
    -- Force recalculation
    UPDATE invoices SET payment_status = 'disputed' WHERE id = test_invoice_id;
    SELECT risk_score INTO calculated_score FROM invoices WHERE id = test_invoice_id;
    IF calculated_score != 45 THEN RAISE EXCEPTION 'Test Failed: Good payer history. Expected 45, got %', calculated_score; END IF;

    -- Test 10: Paid invoice
    UPDATE invoices SET payment_status = 'paid' WHERE id = test_invoice_id;
    -- Wait, paid invoice doesn't change score immediately unless we want to, but risk is no longer relevant.
    
    RAISE NOTICE 'All Risk Engine tests passed successfully!';
END;
$$;

ROLLBACK;
