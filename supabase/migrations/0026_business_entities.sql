-- Phase 15: Multiple Legal Entities

-- 1. Create business_entities table
CREATE TABLE public.business_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    legal_name TEXT,
    country TEXT NOT NULL DEFAULT 'US',
    currency TEXT NOT NULL DEFAULT 'USD',
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    gstin TEXT,
    udyam_number TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on business_entities
ALTER TABLE public.business_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entities of their businesses" ON public.business_entities 
    FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY "Owners and admins can manage entities" ON public.business_entities 
    FOR ALL USING (public.has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role]));

-- 2. Migrate existing businesses into primary business_entities
INSERT INTO public.business_entities (
    business_id, 
    name, 
    legal_name, 
    country, 
    currency, 
    timezone, 
    gstin, 
    udyam_number, 
    is_primary
)
SELECT 
    id, 
    name, 
    COALESCE(legal_name, name), 
    COALESCE(country, 'US'), 
    COALESCE(default_currency, 'USD'), 
    COALESCE(timezone, 'America/New_York'), 
    gstin, 
    udyam_number, 
    true
FROM public.businesses;

-- 3. Add entity_id to invoices
ALTER TABLE public.invoices 
ADD COLUMN entity_id UUID REFERENCES public.business_entities(id) ON DELETE RESTRICT;

-- 4. Backfill entity_id for existing invoices
UPDATE public.invoices i
SET entity_id = e.id
FROM public.business_entities e
WHERE i.business_id = e.business_id AND e.is_primary = true;

-- 5. Make entity_id NOT NULL
ALTER TABLE public.invoices 
ALTER COLUMN entity_id SET NOT NULL;

-- 6. Update the RPC to insert the entity immediately upon business creation
CREATE OR REPLACE FUNCTION public.create_business_with_owner(
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

    -- Insert into businesses (we still keep the legacy fields for now to avoid dropping columns that might break old views, but we don't rely on them in UI)
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

    -- Insert primary entity
    INSERT INTO public.business_entities (
        business_id,
        name,
        legal_name,
        country,
        currency,
        timezone,
        gstin,
        udyam_number,
        is_primary
    )
    VALUES (
        v_business_id,
        p_name,
        p_legal_name,
        p_country,
        p_default_currency,
        p_timezone,
        p_gstin,
        p_udyam_number,
        true
    );

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
