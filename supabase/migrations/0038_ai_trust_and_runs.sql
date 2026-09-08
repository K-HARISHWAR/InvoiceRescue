-- Create ai_runs table for tracking AI usage, performance and errors
CREATE TABLE ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    feature TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    tokens_used INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

-- Policies for ai_runs
CREATE POLICY "Users can view ai_runs for their business" ON ai_runs
    FOR SELECT
    USING (business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
    ));

-- Note: Inserting into ai_runs is primarily done via RPC to bypass RLS for edge functions
CREATE OR REPLACE FUNCTION log_ai_run(
    p_business_id UUID,
    p_user_id UUID,
    p_feature TEXT,
    p_provider TEXT,
    p_model TEXT,
    p_status TEXT,
    p_latency_ms INTEGER,
    p_tokens_used INTEGER,
    p_error_message TEXT
) RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO ai_runs (
        business_id, user_id, feature, provider, model, 
        status, latency_ms, tokens_used, error_message
    ) VALUES (
        p_business_id, p_user_id, p_feature, p_provider, p_model, 
        p_status, p_latency_ms, p_tokens_used, p_error_message
    ) RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create ai_feedback table for explicit user feedback
CREATE TABLE ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    feature TEXT NOT NULL, -- 'invoice_extraction', 'email_classification', 'promise_detection', 'draft_usefulness'
    entity_type TEXT NOT NULL, -- 'invoice', 'communication', 'collection_action'
    entity_id UUID NOT NULL,
    ai_run_id UUID REFERENCES ai_runs(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL, -- 1 for correct/helpful, -1 for incorrect/unhelpful
    correction TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

-- Policies for ai_feedback
CREATE POLICY "Users can insert feedback for their business" ON ai_feedback
    FOR INSERT
    WITH CHECK (business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can view feedback for their business" ON ai_feedback
    FOR SELECT
    USING (business_id IN (
        SELECT business_id FROM business_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update their own feedback" ON ai_feedback
    FOR UPDATE
    USING (user_id = auth.uid());


-- Modify payment_promises for AI source attribution
ALTER TABLE payment_promises 
ADD COLUMN source_communication_id UUID REFERENCES communications(id) ON DELETE SET NULL,
ADD COLUMN confidence_score FLOAT;
