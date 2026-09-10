import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.TEST_EMAIL || 'test@example.com';
const password = process.env.TEST_PASSWORD || 'password123';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  // Login first to get a token
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  const businessId = authData.user?.user_metadata?.business_id;
  console.log("Logged in, invoking gmail-sync with business_id:", businessId);

  const { data, error } = await supabase.functions.invoke('gmail-sync', {
    body: { business_id: businessId }
  });

  console.log("Result data:", data);
  console.log("Result error:", error);
}

test();
