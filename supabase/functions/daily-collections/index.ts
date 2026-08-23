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

    // Call the RPC that handles all the complex logic transactionally
    const { error } = await supabase.rpc('run_daily_collections_workflow')

    if (error) {
      console.error('Failed to run daily collections workflow:', error)
      throw error
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
