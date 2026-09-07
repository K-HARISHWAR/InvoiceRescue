-- Add reconciliation_status to payments
ALTER TABLE payments ADD COLUMN reconciliation_status TEXT DEFAULT 'verified' CHECK (reconciliation_status IN ('unmatched', 'matched', 'verified'));

-- Create payment_revisions table
CREATE TABLE payment_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
    revision_number INT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    change_reason TEXT,
    before_data JSONB,
    after_data JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index and RLS
CREATE INDEX idx_payment_revisions_payment_id ON payment_revisions(payment_id);
CREATE INDEX idx_payment_revisions_business_id ON payment_revisions(business_id);

ALTER TABLE payment_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment revisions for their businesses"
    ON payment_revisions FOR SELECT
    USING (business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert payment revisions for their businesses"
    ON payment_revisions FOR INSERT
    WITH CHECK (business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
    ));
