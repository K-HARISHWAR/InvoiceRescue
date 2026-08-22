// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getValidAccessToken, sendGmailMessage } from "../_shared/google.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action_id } = await req.json();
    if (!action_id) throw new Error("Missing action_id");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // We use service key to bypass RLS for token decryption and db updates, but we verify user first
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await anonClient.auth.getUser(jwt);
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the action and verify ownership
    const { data: action, error: actionError } = await adminClient
      .from('collection_actions')
      .select('*, invoices(*, customers(*))')
      .eq('id', action_id)
      .single();

    if (actionError || !action) throw new Error('Action not found');

    if (action.status !== 'approved') {
      throw new Error('Action is not in approved state');
    }

    if (!action.draft_subject || !action.draft_body) {
      throw new Error('Action is missing draft content');
    }

    // Verify user belongs to business
    const { data: member, error: memberError } = await adminClient
      .from('business_members')
      .select('role')
      .eq('business_id', action.business_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) throw new Error('Unauthorized for this business');

    const customerEmail = action.invoices.customers.primary_email;
    if (!customerEmail) throw new Error('Customer has no email address');

    // Get Google Token
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim().replace(/^["']|["']$/g, '')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim().replace(/^["']|["']$/g, '')!;
    const tokenEncryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')?.trim().replace(/^["']|["']$/g, '')!;

    const accessToken = await getValidAccessToken(adminClient, action.business_id, tokenEncryptionKey, clientId, clientSecret);

    // Send Email
    const sendResult = await sendGmailMessage(
      accessToken,
      customerEmail,
      action.draft_subject,
      action.draft_body
    );

    // Mark action as sent and record communication
    await adminClient.from('collection_actions').update({
      status: 'sent',
      executed_at: new Date().toISOString()
    }).eq('id', action_id);

    await adminClient.from('communications').insert({
      business_id: action.business_id,
      customer_id: action.invoices.customer_id,
      invoice_id: action.invoice_id,
      channel: 'email',
      direction: 'outbound',
      from_address: 'me', // Default placeholder, or we can fetch the google_email from connection
      to_addresses: [customerEmail],
      subject: action.draft_subject,
      body_text: action.draft_body,
      sent_at: new Date().toISOString(),
      created_by: user.id
    });

    return new Response(JSON.stringify({ success: true, messageId: sendResult.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const fullError = error instanceof Error ? error.stack : String(error);
    console.error("Error in gmail-send:", fullError);
    return new Response(JSON.stringify({ success: false, error: errorMsg || fullError || 'Unknown error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
