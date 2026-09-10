CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(identifier, action)
);

-- Enable RLS (only service role needs access usually, but we'll allow authenticated just in case, though Edge Functions use service_role)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Function to check and update rate limit atomically
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_identifier TEXT,
    p_action TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    -- Delete expired records (garbage collection)
    DELETE FROM public.rate_limits 
    WHERE identifier = p_identifier 
      AND action = p_action 
      AND reset_at < now();

    -- Try to insert a new record or update existing
    INSERT INTO public.rate_limits (identifier, action, count, reset_at)
    VALUES (p_identifier, p_action, 1, now() + (p_window_seconds || ' seconds')::interval)
    ON CONFLICT (identifier, action) DO UPDATE
    SET count = public.rate_limits.count + 1
    RETURNING count INTO v_current_count;

    IF v_current_count > p_max_requests THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;
