-- Phase 14: Organisation Archive and Leaving

-- Add archive fields to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id);

-- Update businesses RLS to prevent viewing archived businesses unless you're an owner or admin (for restoration later if needed)
-- Wait, the spec says "An archived organisation: disappears from normal switcher, stops automation..."
-- It might be safer to let the frontend filter `WHERE archived_at IS NULL` for the standard switcher, 
-- but let's keep RLS simple and allow reading if you're a member.

-- RPC to archive a business
CREATE OR REPLACE FUNCTION archive_business(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role business_role;
BEGIN
    -- Check if authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user is an owner of the business
    SELECT role INTO v_role 
    FROM public.business_members 
    WHERE business_id = p_business_id AND user_id = auth.uid();

    IF v_role IS NULL OR v_role != 'owner' THEN
        RAISE EXCEPTION 'Only owners can archive the organisation';
    END IF;

    -- Archive
    UPDATE public.businesses 
    SET archived_at = NOW(), archived_by = auth.uid()
    WHERE id = p_business_id;
END;
$$;

-- RPC to leave a business
CREATE OR REPLACE FUNCTION leave_business(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role business_role;
    v_owner_count INTEGER;
BEGIN
    -- Check if authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check user role
    SELECT role INTO v_role 
    FROM public.business_members 
    WHERE business_id = p_business_id AND user_id = auth.uid();

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'You are not a member of this organisation';
    END IF;

    -- If owner, ensure they are not the last owner
    IF v_role = 'owner' THEN
        SELECT COUNT(*) INTO v_owner_count 
        FROM public.business_members 
        WHERE business_id = p_business_id AND role = 'owner';

        IF v_owner_count <= 1 THEN
            RAISE EXCEPTION 'You are the last owner. You must archive the organisation or promote someone else to owner before leaving.';
        END IF;
    END IF;

    -- Delete membership
    DELETE FROM public.business_members 
    WHERE business_id = p_business_id AND user_id = auth.uid();
END;
$$;
