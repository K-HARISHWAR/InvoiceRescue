-- Edge Case and Database Hardening Tests
BEGIN;

DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_business_id UUID := gen_random_uuid();
    test_entity_id UUID := gen_random_uuid();
    test_customer_id UUID := gen_random_uuid();
    test_invoice_id UUID := gen_random_uuid();
    test_payment_id UUID := gen_random_uuid();
    caught_error BOOLEAN := false;
    invoice_count INTEGER;
BEGIN
    -- Setup dummy data
    INSERT INTO auth.users (id, email) VALUES (test_user_id, 'test_edge@example.com');
    
    INSERT INTO businesses (id, name, owner_user_id) VALUES (test_business_id, 'Edge Case Business', test_user_id);
    INSERT INTO business_members (business_id, user_id, role) VALUES (test_business_id, test_user_id, 'owner');
    
    INSERT INTO business_entities (id, business_id, name, country, currency, timezone, is_primary) 
    VALUES (test_entity_id, test_business_id, 'Edge Entity', 'US', 'USD', 'UTC', true);
    
    INSERT INTO customers (id, business_id, name) VALUES (test_customer_id, test_business_id, 'Edge Customer');
    
    INSERT INTO invoices (id, business_id, entity_id, customer_id, invoice_number, total_amount, outstanding_amount, payment_status, due_date)
    VALUES (test_invoice_id, test_business_id, test_entity_id, test_customer_id, 'INV-EDGE-01', 1000, 1000, 'open', CURRENT_DATE + 30);

    -- Test 1: Duplicate invoice number for the same entity should fail
    caught_error := false;
    BEGIN
        INSERT INTO invoices (id, business_id, entity_id, customer_id, invoice_number, total_amount, outstanding_amount, payment_status, due_date)
        VALUES (gen_random_uuid(), test_business_id, test_entity_id, test_customer_id, 'INV-EDGE-01', 500, 500, 'open', CURRENT_DATE + 30);
    EXCEPTION WHEN unique_violation THEN
        caught_error := true;
    END;
    IF NOT caught_error THEN RAISE EXCEPTION 'Test Failed: Duplicate invoice number was allowed!'; END IF;

    -- Test 2: Negative invoice amount should fail
    caught_error := false;
    BEGIN
        INSERT INTO invoices (id, business_id, entity_id, customer_id, invoice_number, total_amount, outstanding_amount, payment_status, due_date)
        VALUES (gen_random_uuid(), test_business_id, test_entity_id, test_customer_id, 'INV-EDGE-02', -500, -500, 'open', CURRENT_DATE + 30);
    EXCEPTION WHEN check_violation THEN
        caught_error := true;
    END;
    IF NOT caught_error THEN RAISE EXCEPTION 'Test Failed: Negative invoice amount was allowed!'; END IF;

    -- Test 3: Negative payment amount should fail
    caught_error := false;
    BEGIN
        INSERT INTO payments (id, business_id, invoice_id, amount)
        VALUES (gen_random_uuid(), test_business_id, test_invoice_id, -100);
    EXCEPTION WHEN check_violation THEN
        caught_error := true;
    END;
    IF NOT caught_error THEN RAISE EXCEPTION 'Test Failed: Negative payment amount was allowed!'; END IF;

    -- Test 4: Overpayment should fail
    caught_error := false;
    BEGIN
        INSERT INTO payments (id, business_id, invoice_id, amount)
        VALUES (gen_random_uuid(), test_business_id, test_invoice_id, 1500); -- Outstanding is 1000
    EXCEPTION WHEN raise_exception THEN
        caught_error := true;
    END;
    IF NOT caught_error THEN RAISE EXCEPTION 'Test Failed: Overpayment was allowed!'; END IF;

    -- Test 5: Valid payment should succeed
    INSERT INTO payments (id, business_id, invoice_id, amount)
    VALUES (test_payment_id, test_business_id, test_invoice_id, 500);
    -- Ensure trigger didn't block it
    
    -- Test 6: Updating payment to cause overpayment should fail
    caught_error := false;
    BEGIN
        UPDATE payments SET amount = 1200 WHERE id = test_payment_id;
    EXCEPTION WHEN raise_exception THEN
        caught_error := true;
    END;
    IF NOT caught_error THEN RAISE EXCEPTION 'Test Failed: Payment update causing overpayment was allowed!'; END IF;

    -- Test 7: RLS - Removing member revokes access immediately
    -- To test RLS within a transaction, we set the local role and request.jwt.claims
    -- First, ensure member can see the invoice
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', test_user_id), true);
    
    SELECT COUNT(*) INTO invoice_count FROM invoices WHERE id = test_invoice_id;
    IF invoice_count = 0 THEN RAISE EXCEPTION 'Test Failed: RLS blocked access for valid member!'; END IF;

    -- Now remove the user from business_members (elevating privileges temporarily)
    PERFORM set_config('role', 'postgres', true);
    DELETE FROM business_members WHERE business_id = test_business_id AND user_id = test_user_id;
    
    -- Check access again
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', format('{"sub": "%s"}', test_user_id), true);
    
    SELECT COUNT(*) INTO invoice_count FROM invoices WHERE id = test_invoice_id;
    IF invoice_count > 0 THEN RAISE EXCEPTION 'Test Failed: RLS allowed access after membership revoked!'; END IF;

    -- Restore privileges
    PERFORM set_config('role', 'postgres', true);

    RAISE NOTICE 'All Edge Case tests passed successfully!';
END;
$$;

ROLLBACK;
