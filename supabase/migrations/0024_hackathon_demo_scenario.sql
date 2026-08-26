-- Inject the exact Hackathon Demo Scenario timeline for ABC Enterprises

DO $$
DECLARE
    demo_user_id UUID;
    demo_business_id UUID := '11111111-1111-1111-1111-111111111111';
    c5_id UUID := '22222222-2222-2222-2222-222222222225';
    inv_c5_1 UUID := '33333333-3333-3333-3333-333333333333';
    
    comm_1 UUID := gen_random_uuid();
    comm_2 UUID := gen_random_uuid();
    comm_3 UUID := gen_random_uuid();
    
    act_1 UUID := gen_random_uuid();
    act_2 UUID := gen_random_uuid();
BEGIN
    SELECT id INTO demo_user_id FROM auth.users LIMIT 1;
    
    IF demo_user_id IS NULL THEN
        RETURN; -- No user yet, gracefully skip.
    END IF;

    -- Clean up previous timeline for this invoice if it exists so it doesn't duplicate on re-run
    DELETE FROM communications WHERE invoice_id = inv_c5_1;
    DELETE FROM payment_promises WHERE invoice_id = inv_c5_1;
    DELETE FROM risk_events WHERE invoice_id = inv_c5_1;
    DELETE FROM collection_actions WHERE invoice_id = inv_c5_1;

    -- Update Invoice Details to perfectly match the PDF
    UPDATE invoices SET 
        invoice_date = '2026-08-17',
        due_date = '2026-09-16',
        total_amount = 240000,
        outstanding_amount = 240000,
        payment_status = 'disputed',
        collection_stage = 'escalated',
        risk_score = 82,
        risk_level = 'critical'
    WHERE id = inv_c5_1;

    -- TIMELINE EVENTS
    
    -- 11 Sep: Friendly reminder
    INSERT INTO collection_actions (id, business_id, invoice_id, action_type, status, executed_at, created_at)
    VALUES (act_1, demo_business_id, inv_c5_1, 'friendly_reminder', 'completed', '2026-09-11 10:00:00+00', '2026-09-11 09:00:00+00');
    
    INSERT INTO communications (id, business_id, customer_id, invoice_id, channel, direction, subject, body_text, category, sent_at, created_at)
    VALUES (comm_1, demo_business_id, c5_id, inv_c5_1, 'email', 'outbound', 'Friendly Reminder: Invoice INV-1043', 'Just a friendly reminder that invoice INV-1043 is due soon.', 'general', '2026-09-11 10:00:00+00', '2026-09-11 10:00:00+00');

    -- 12 Sep: Customer promises payment by 18 Sep
    INSERT INTO communications (id, business_id, customer_id, invoice_id, channel, direction, subject, body_text, category, category_confidence, sent_at, created_at)
    VALUES (comm_2, demo_business_id, c5_id, inv_c5_1, 'email', 'inbound', 'Re: Friendly Reminder: Invoice INV-1043', 'Payment expected 18 Sep', 'payment_promise', 0.95, '2026-09-12 14:30:00+00', '2026-09-12 14:30:00+00');
    
    INSERT INTO payment_promises (business_id, invoice_id, communication_id, promised_date, status, created_at)
    VALUES (demo_business_id, inv_c5_1, comm_2, '2026-09-18', 'missed', '2026-09-12 14:35:00+00');

    -- 20 Sep: Customer promises 25 Sep
    INSERT INTO communications (id, business_id, customer_id, invoice_id, channel, direction, subject, body_text, category, category_confidence, sent_at, created_at)
    VALUES (comm_3, demo_business_id, c5_id, inv_c5_1, 'email', 'inbound', 'Re: Invoice INV-1043 Overdue', 'Apologies, we had a delay. Payment will be processed on 25 Sep.', 'payment_promise', 0.98, '2026-09-20 11:15:00+00', '2026-09-20 11:15:00+00');
    
    INSERT INTO payment_promises (business_id, invoice_id, communication_id, promised_date, status, created_at)
    VALUES (demo_business_id, inv_c5_1, comm_3, '2026-09-25', 'missed', '2026-09-20 11:20:00+00');

    -- 2 Oct: Escalation (Action approved and sent)
    INSERT INTO collection_actions (id, business_id, invoice_id, action_type, status, executed_at, created_at)
    VALUES (act_2, demo_business_id, inv_c5_1, 'escalation', 'completed', '2026-10-02 09:00:00+00', '2026-10-01 09:00:00+00');

    -- Risk Event: Escalated to critical
    INSERT INTO risk_events (business_id, invoice_id, previous_score, new_score, risk_level, reasons, calculated_at)
    VALUES (demo_business_id, inv_c5_1, 67, 82, 'critical', '[
        {"code": "MISSED_PROMISE", "points": 15, "description": "Payment promised for 18 Sep was not recorded."},
        {"code": "MISSED_PROMISE", "points": 15, "description": "Payment promised for 25 Sep was not recorded."}
    ]'::jsonb, '2026-10-05 10:00:00+00');

END $$;
