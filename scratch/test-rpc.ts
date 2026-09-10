import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function testRpc() {
  console.log("Starting job run...");
  const { data: jobId, error: startError } = await adminClient.rpc('start_job_run', {
    p_job_name: 'test-job',
    p_business_id: null
  });

  if (startError) {
    console.error("Start Error:", startError);
    return;
  }

  console.log("Started job with ID:", jobId);

  console.log("Finishing job run...");
  const { error: finishError } = await adminClient.rpc('finish_job_run', {
    p_job_id: jobId,
    p_status: 'failed',
    p_processed_count: 0
  });

  if (finishError) {
    console.error("Finish Error:", finishError);
    return;
  }

  console.log("Successfully finished job run.");
}

testRpc();
