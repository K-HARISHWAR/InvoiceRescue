-- 0045_fix_job_run_rpc.sql
DROP FUNCTION IF EXISTS public.finish_job_run(UUID, job_status, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.finish_job_run(
    p_job_id UUID,
    p_status TEXT,
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
        status = p_status::job_status,
        completed_at = now(),
        processed_count = p_processed_count,
        failed_count = p_failed_count,
        error_summary = p_error_summary
    WHERE id = p_job_id;
END;
$$;
