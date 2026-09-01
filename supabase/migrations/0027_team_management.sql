-- 1. Rename existing 'member' role to 'finance_manager'
ALTER TYPE business_role RENAME VALUE 'member' TO 'finance_manager';

-- 2. Add new 'collections_agent' role
ALTER TYPE business_role ADD VALUE 'collections_agent' AFTER 'finance_manager';

-- 3. Member Entity Access
CREATE TABLE member_entity_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_member_id UUID REFERENCES business_members(id) ON DELETE CASCADE NOT NULL,
    entity_id UUID REFERENCES business_entities(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(business_member_id, entity_id)
);

ALTER TABLE member_entity_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entity access for members in their businesses"
    ON member_entity_access FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.id = member_entity_access.business_member_id
            AND EXISTS (
                SELECT 1 FROM business_members current_bm
                WHERE current_bm.business_id = bm.business_id
                AND current_bm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Owners and Admins can manage entity access"
    ON member_entity_access FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_members bm
            WHERE bm.id = member_entity_access.business_member_id
            AND EXISTS (
                SELECT 1 FROM business_members current_bm
                WHERE current_bm.business_id = bm.business_id
                AND current_bm.user_id = auth.uid()
                AND current_bm.role IN ('owner', 'admin')
            )
        )
    );

-- 4. Business Invitations
CREATE TABLE business_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role business_role NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations for their businesses"
    ON business_invitations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM business_members
            WHERE business_members.business_id = business_invitations.business_id
            AND business_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Owners and Admins can manage invitations"
    ON business_invitations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_members
            WHERE business_members.business_id = business_invitations.business_id
            AND business_members.user_id = auth.uid()
            AND business_members.role IN ('owner', 'admin')
        )
    );

-- 5. Invitation Entity Access
CREATE TABLE invitation_entity_access (
    invitation_id UUID REFERENCES business_invitations(id) ON DELETE CASCADE NOT NULL,
    entity_id UUID REFERENCES business_entities(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (invitation_id, entity_id)
);

ALTER TABLE invitation_entity_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitation entity access"
    ON invitation_entity_access FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM business_invitations bi
            JOIN business_members bm ON bi.business_id = bm.business_id
            WHERE bi.id = invitation_entity_access.invitation_id
            AND bm.user_id = auth.uid()
        )
    );

CREATE POLICY "Owners and Admins can manage invitation entity access"
    ON invitation_entity_access FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM business_invitations bi
            JOIN business_members bm ON bi.business_id = bm.business_id
            WHERE bi.id = invitation_entity_access.invitation_id
            AND bm.user_id = auth.uid()
            AND bm.role IN ('owner', 'admin')
        )
    );

-- Add accept_invitation RPC helper
CREATE OR REPLACE FUNCTION accept_invitation(p_token_hash TEXT, p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation RECORD;
    v_member_id UUID;
    v_entity_record RECORD;
BEGIN
    -- Find active invitation
    SELECT * INTO v_invitation
    FROM business_invitations
    WHERE token_hash = p_token_hash
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or revoked invitation.';
    END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM business_members
        WHERE business_id = v_invitation.business_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User is already a member of this workspace.';
    END IF;

    -- Create member
    INSERT INTO business_members (business_id, user_id, role)
    VALUES (v_invitation.business_id, p_user_id, v_invitation.role)
    RETURNING id INTO v_member_id;

    -- Copy entity access
    FOR v_entity_record IN
        SELECT entity_id FROM invitation_entity_access WHERE invitation_id = v_invitation.id
    LOOP
        INSERT INTO member_entity_access (business_member_id, entity_id)
        VALUES (v_member_id, v_entity_record.entity_id);
    END LOOP;

    -- Mark accepted
    UPDATE business_invitations
    SET accepted_at = NOW()
    WHERE id = v_invitation.id;

    RETURN json_build_object('success', true, 'business_id', v_invitation.business_id);
END;
$$;
