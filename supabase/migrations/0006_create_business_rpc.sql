CREATE OR REPLACE FUNCTION create_business_with_owner(
    p_name TEXT,
    p_legal_name TEXT,
    p_country TEXT,
    p_default_currency TEXT,
    p_timezone TEXT,
    p_gstin TEXT,
    p_udyam_number TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
BEGIN
    -- Check if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Insert into businesses
    INSERT INTO public.businesses (
        owner_user_id,
        name,
        legal_name,
        country,
        default_currency,
        timezone,
        gstin,
        udyam_number
    )
    VALUES (
        auth.uid(),
        p_name,
        p_legal_name,
        p_country,
        p_default_currency,
        p_timezone,
        p_gstin,
        p_udyam_number
    )
    RETURNING id INTO v_business_id;

    -- Insert into business_members as owner
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role
    )
    VALUES (
        v_business_id,
        auth.uid(),
        'owner'::business_role
    );

    RETURN v_business_id;
END;
$$;
