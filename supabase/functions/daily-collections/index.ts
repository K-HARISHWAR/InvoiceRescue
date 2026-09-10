import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables.')
    }

    // Use service role key to bypass RLS for system cron job
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const startTime = performance.now()
    
    // Start job logging
    const { data: jobId, error: startError } = await supabase.rpc('start_job_run', {
      p_job_name: 'daily-collections-cron'
    })
    if (startError) console.error("Failed to start job log:", startError)

    // Call the RPC that handles all the complex logic transactionally
    const { data: result, error } = await supabase.rpc('run_daily_collections_workflow')

    const duration_ms = Math.round(performance.now() - startTime)

    if (error) {
      console.error(JSON.stringify({ event: 'daily-collections-failed', duration_ms, error: error.message }))
      if (jobId) {
        await supabase.rpc('finish_job_run', {
          p_job_id: jobId,
          p_status: 'failed',
          p_error_summary: error.message
        })
      }
      throw error
    }

    console.log(JSON.stringify({ event: 'daily-collections-success', duration_ms, processed: result || 0 }))
    
    if (jobId) {
      await supabase.rpc('finish_job_run', {
        p_job_id: jobId,
        p_status: 'completed',
        p_processed_count: typeof result === 'number' ? result : 0
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Daily collections workflow completed.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Daily collections error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "DAILY_COLLECTIONS_FAILED",
          message: error instanceof Error ? error.message : "Unknown error occurred"
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
