-- Create notification preferences table
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    in_app BOOLEAN DEFAULT true,
    email BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_type)
);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own preferences" ON notification_preferences
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences" ON notification_preferences
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences" ON notification_preferences
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences" ON notification_preferences
    FOR DELETE
    USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
