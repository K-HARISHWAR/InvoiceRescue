CREATE TYPE job_status AS ENUM ('running', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status job_status NOT NULL DEFAULT 'running',
    processed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT
);

-- Enable RLS
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Admins/owners can view jobs for their business or global jobs (business_id is null)
CREATE POLICY "Users can view job runs for their business" ON public.job_runs
    FOR SELECT TO authenticated
    USING (
        business_id IS NULL OR 
        is_business_member(business_id)
    );

-- Creating a helper RPC to create a job log and return the ID
CREATE OR REPLACE FUNCTION public.start_job_run(
    p_job_name TEXT,
    p_business_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    INSERT INTO public.job_runs (job_name, business_id, status, started_at)
    VALUES (p_job_name, p_business_id, 'running', now())
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$;

-- Creating a helper RPC to finish a job log
CREATE OR REPLACE FUNCTION public.finish_job_run(
    p_job_id UUID,
    p_status job_status,
    p_processed_count INTEGER DEFAULT 0,
    p_failed_count INTEGER DEFAULT 0,
    p_error_summary TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.job_runs
    SET 
        status = p_status,
        completed_at = now(),
        processed_count = p_processed_count,
        failed_count = p_failed_count,
        error_summary = p_error_summary
    WHERE id = p_job_id;
END;
$$;
