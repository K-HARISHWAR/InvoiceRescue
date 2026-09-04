-- Phase 18: Customer Management Professionalization

-- 1. Create contact role enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_role') THEN
        CREATE TYPE contact_role AS ENUM ('accounts_payable', 'finance', 'procurement', 'owner', 'management', 'general');
    END IF;
END
$$;

-- 2. Alter customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS default_payment_terms_days INT,
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3),
ADD COLUMN IF NOT EXISTS default_entity_id UUID REFERENCES public.business_entities(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collection_notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Create customer_contacts table
CREATE TABLE IF NOT EXISTS public.customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    job_title TEXT,
    role contact_role DEFAULT 'general',
    is_primary BOOLEAN DEFAULT false,
    receives_collection_emails BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create customer_notes table
CREATE TABLE IF NOT EXISTS public.customer_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Users can view contacts of their businesses" ON public.customer_contacts
    FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY "Finance managers and above can modify contacts" ON public.customer_contacts
    FOR ALL USING (
        public.has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role, 'finance_manager'::business_role, 'collections_agent'::business_role])
    );

CREATE POLICY "Users can view notes of their businesses" ON public.customer_notes
    FOR SELECT USING (public.is_business_member(business_id));

CREATE POLICY "Team members can modify notes" ON public.customer_notes
    FOR ALL USING (
        public.has_business_role(business_id, ARRAY['owner'::business_role, 'admin'::business_role, 'finance_manager'::business_role, 'collections_agent'::business_role])
    );

-- 7. RPC for merging customers
CREATE OR REPLACE FUNCTION public.merge_customers(
    p_target_customer_id UUID,
    p_source_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target RECORD;
    v_source RECORD;
    v_business_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Get target
    SELECT * INTO v_target FROM public.customers WHERE id = p_target_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target customer not found.';
    END IF;

    -- Get source
    SELECT * INTO v_source FROM public.customers WHERE id = p_source_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source customer not found.';
    END IF;

    -- Validate they belong to the same business
    IF v_target.business_id != v_source.business_id THEN
        RAISE EXCEPTION 'Cannot merge customers from different businesses.';
    END IF;

    v_business_id := v_target.business_id;

    -- Check permissions
    IF NOT public.has_business_role(v_business_id, ARRAY['owner'::business_role, 'admin'::business_role, 'finance_manager'::business_role]) THEN
        RAISE EXCEPTION 'Permission denied: Must be Finance Manager or above to merge customers.';
    END IF;

    -- Re-assign invoices
    UPDATE public.invoices SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;

    -- Re-assign communications
    UPDATE public.communications SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;

    -- Re-assign contacts
    UPDATE public.customer_contacts SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;

    -- Re-assign notes
    UPDATE public.customer_notes SET customer_id = p_target_customer_id WHERE customer_id = p_source_customer_id;

    -- Update audit logs if any (assuming audit_logs exist and track customer_id in metadata)
    -- This is optional depending on exact audit log implementation.

    -- Archive source customer
    UPDATE public.customers 
    SET archived_at = NOW(),
        archived_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_source_customer_id;

    -- Create an audit event for the merge
    INSERT INTO public.audit_logs (
        business_id,
        actor_user_id,
        event_type,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        v_business_id,
        v_user_id,
        'customer_merged',
        'customer',
        p_target_customer_id,
        jsonb_build_object(
            'source_customer_id', p_source_customer_id,
            'source_customer_name', v_source.name
        )
    );

    RETURN jsonb_build_object('success', true, 'target_id', p_target_customer_id, 'source_id', p_source_customer_id);
END;
$$;
