-- 0047_harden_edge_cases.sql

-- 1. Invoices Constraints

-- Deduplicate invoices before adding unique constraint
-- If there are exact duplicates, we append a random suffix to the older ones to allow the constraint to build
UPDATE public.invoices i
SET invoice_number = invoice_number || '-' || substr(md5(random()::text), 1, 4)
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY entity_id, invoice_number ORDER BY created_at DESC) as rn
    FROM public.invoices
  ) t WHERE rn > 1
);

-- Ensure total_amount is not negative
ALTER TABLE public.invoices ADD CONSTRAINT invoices_total_amount_check CHECK (total_amount >= 0);

-- Ensure invoice_number is unique per entity
ALTER TABLE public.invoices ADD CONSTRAINT invoices_entity_id_invoice_number_key UNIQUE (entity_id, invoice_number);

-- 2. Payments Constraints
-- Ensure payment amount is strictly positive
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_check CHECK (amount > 0);

-- Trigger to prevent overpayments
CREATE OR REPLACE FUNCTION public.prevent_overpayment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_outstanding_amount NUMERIC;
BEGIN
    SELECT outstanding_amount INTO v_outstanding_amount
    FROM public.invoices
    WHERE id = NEW.invoice_id;

    -- If this is an insert, check if the amount exceeds outstanding
    IF TG_OP = 'INSERT' THEN
        IF NEW.amount > v_outstanding_amount THEN
            RAISE EXCEPTION 'Payment amount (%) exceeds outstanding invoice amount (%)', NEW.amount, v_outstanding_amount;
        END IF;
    -- If this is an update, calculate the net change
    ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.amount - OLD.amount) > v_outstanding_amount THEN
            RAISE EXCEPTION 'Updated payment amount increases total paid by (%) which exceeds outstanding invoice amount (%)', (NEW.amount - OLD.amount), v_outstanding_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_overpayment ON public.payments;
CREATE TRIGGER check_overpayment
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_overpayment();
