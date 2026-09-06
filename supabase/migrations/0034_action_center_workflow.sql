-- 1. Upgrade action states to include 'snoozed'
ALTER TYPE action_status ADD VALUE IF NOT EXISTS 'snoozed';

-- 2. Add assignment and snooze fields to collection_actions
ALTER TABLE collection_actions 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ;

-- 3. Internal comments table
CREATE TABLE action_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    action_id UUID REFERENCES collection_actions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE action_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view action comments for their business" ON action_comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.business_id = action_comments.business_id
            AND bm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert action comments for their business" ON action_comments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.business_id = action_comments.business_id
            AND bm.user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- 4. Saved views table
CREATE TABLE saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL DEFAULT 'action',
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own saved views" ON saved_views
    FOR ALL
    USING (
        user_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.business_id = saved_views.business_id
            AND bm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid()
    );
