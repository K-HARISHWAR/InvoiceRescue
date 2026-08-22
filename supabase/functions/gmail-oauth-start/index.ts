// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function signState(stateObj: any, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const stateString = JSON.stringify(stateObj);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(stateString));
  
  // Convert signature to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return btoa(JSON.stringify({ ...stateObj, sig: hashHex }));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id } = await req.json();

    if (!business_id) {
      throw new Error("Missing business_id");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const anonClient = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await anonClient.auth.getUser(jwt);
    if (userError || !user) {
      throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify business membership
    const { data: member, error: memberError } = await adminClient
      .from('business_members')
      .select('role')
      .eq('business_id', business_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member || (member.role !== 'owner' && member.role !== 'admin')) {
      throw new Error('You do not have permission to connect Gmail for this business');
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim().replace(/^["']|["']$/g, '');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')?.trim().replace(/^["']|["']$/g, '');
    const tokenEncryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')?.trim().replace(/^["']|["']$/g, '');

    if (!clientId || !redirectUri || !tokenEncryptionKey) {
      throw new Error("Google OAuth environment variables are not fully configured");
    }

    const stateObj = {
      b: business_id,
      u: user.id,
      t: Date.now()
    };

    const stateParam = await signState(stateObj, tokenEncryptionKey);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send email',
      access_type: 'offline',
      prompt: 'consent', // Force consent to ensure we get a refresh token
      state: stateParam
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ success: true, url: authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in gmail-oauth-start:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
