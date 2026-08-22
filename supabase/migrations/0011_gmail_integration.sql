-- Migration for Gmail OAuth Integration

CREATE TYPE gmail_connection_status AS ENUM ('connected', 'disconnected', 'error');

CREATE TABLE gmail_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    google_email TEXT NOT NULL,
    encrypted_refresh_token TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[] NOT NULL,
    status gmail_connection_status NOT NULL DEFAULT 'connected',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_id) -- one connection per business for simplicity in MVP
);

CREATE INDEX idx_gmail_connections_business_id ON gmail_connections(business_id);
CREATE INDEX idx_gmail_connections_user_id ON gmail_connections(user_id);

-- Enable RLS
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

-- We explicitly do NOT create policies for 'authenticated' users to SELECT from gmail_connections 
-- to prevent leaking encrypted tokens to the browser.
-- Instead, we provide a secure view of only safe metadata.

CREATE VIEW business_gmail_status AS
SELECT 
    id,
    business_id,
    google_email as email,
    status,
    last_synced_at,
    updated_at
FROM gmail_connections;

-- Allow authenticated users to query the view for businesses they belong to
GRANT SELECT ON business_gmail_status TO authenticated;

-- Ensure RLS-like logic for the view by joining with business_members
-- Wait, views don't inherit RLS automatically unless created with security barrier or joining.
-- Let's just create an RPC function to get the status securely.
DROP VIEW business_gmail_status;

CREATE OR REPLACE FUNCTION get_gmail_connection_status(p_business_id UUID)
RETURNS TABLE (
    is_connected BOOLEAN,
    email TEXT,
    last_synced_at TIMESTAMPTZ,
    status TEXT
) AS $$
BEGIN
    -- Check if user is a member of the business
    IF NOT EXISTS (
        SELECT 1 FROM business_members 
        WHERE business_id = p_business_id 
        AND user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        (c.status = 'connected') as is_connected,
        c.google_email as email,
        c.last_synced_at,
        c.status::TEXT
    FROM gmail_connections c
    WHERE c.business_id = p_business_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
