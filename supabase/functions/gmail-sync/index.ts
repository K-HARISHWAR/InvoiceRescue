// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getValidAccessToken } from "../_shared/google.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchGmailMessage(accessToken: string, messageId: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return await res.json();
}

function parseEmailPayload(payload: any) {
  let body = '';
  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
    if (textPart && textPart.body && textPart.body.data) {
      body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else {
      // Look deeper
      for (const part of payload.parts) {
        if (part.parts) {
          const innerTextPart = part.parts.find((p: any) => p.mimeType === 'text/plain');
          if (innerTextPart && innerTextPart.body && innerTextPart.body.data) {
            body = atob(innerTextPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            break;
          }
        }
      }
    }
  } else if (payload.body && payload.body.data) {
    body = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  return body;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { business_id } = await req.json();
    if (!business_id) throw new Error("Missing business_id");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await anonClient.auth.getUser(jwt);
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user belongs to business
    const { data: member, error: memberError } = await adminClient
      .from('business_members')
      .select('role')
      .eq('business_id', business_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) throw new Error('Unauthorized for this business');

    // Get Google Token
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim().replace(/^["']|["']$/g, '')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim().replace(/^["']|["']$/g, '')!;
    const tokenEncryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')?.trim().replace(/^["']|["']$/g, '')!;

    const accessToken = await getValidAccessToken(adminClient, business_id, tokenEncryptionKey, clientId, clientSecret);

    // Get customers to know whose emails to look for
    const { data: customers } = await adminClient
      .from('customers')
      .select('id, primary_email')
      .eq('business_id', business_id)
      .not('primary_email', 'is', null);

    if (!customers || customers.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: "No customers with emails found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build query to find emails from these customers in the last 7 days
    const emails = customers.map(c => `from:${c.primary_email}`).join(' OR ');
    const query = `(${emails}) newer_than:7d`;

    const searchRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    const searchData = await searchRes.json();
    const messages = searchData.messages || [];

    if (messages.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, message: "No new emails found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get already synced message IDs to avoid duplicates
    const { data: existingComms } = await adminClient
      .from('communications')
      .select('external_message_id')
      .eq('business_id', business_id)
      .not('external_message_id', 'is', null)
      .in('external_message_id', messages.map((m: any) => m.id));

    const existingIds = new Set(existingComms?.map(c => c.external_message_id) || []);
    let syncedCount = 0;

    for (const msg of messages) {
      if (existingIds.has(msg.id)) continue;

      const fullMsg = await fetchGmailMessage(accessToken, msg.id);
      if (!fullMsg.payload || !fullMsg.payload.headers) continue;

      const headers = fullMsg.payload.headers;
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      
      const bodyText = parseEmailPayload(fullMsg.payload);
      
      // Find which customer this is from
      // fromHeader usually looks like "John Doe <john@example.com>"
      const customer = customers.find(c => fromHeader.toLowerCase().includes(c.primary_email.toLowerCase()));
      if (!customer) continue; // Should not happen given our query, but safety first

      // Try to associate with an invoice
      // Look for invoice ID in subject or body. A simple heuristic: check if any open invoice number is mentioned
      const { data: openInvoices } = await adminClient
        .from('invoices')
        .select('id, invoice_number')
        .eq('customer_id', customer.id)
        .neq('payment_status', 'paid');
        
      let matchedInvoiceId = null;
      if (openInvoices) {
        for (const inv of openInvoices) {
          if (subject.includes(inv.invoice_number) || bodyText.includes(inv.invoice_number)) {
            matchedInvoiceId = inv.id;
            break;
          }
        }
      }

      await adminClient.from('communications').insert({
        business_id,
        customer_id: customer.id,
        invoice_id: matchedInvoiceId,
        channel: 'email',
        direction: 'inbound',
        external_message_id: msg.id,
        external_thread_id: fullMsg.threadId,
        from_address: fromHeader,
        to_addresses: [toHeader],
        subject,
        body_text: bodyText,
        sent_at: new Date(parseInt(fullMsg.internalDate)).toISOString(),
        created_by: user.id
      });
      
      syncedCount++;
    }

    // Update last_synced_at
    await adminClient.from('gmail_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('business_id', business_id);

    return new Response(JSON.stringify({ success: true, synced: syncedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const fullError = error instanceof Error ? error.stack : String(error);
    console.error("Error in gmail-sync:", fullError);
    return new Response(JSON.stringify({ success: false, error: errorMsg || fullError || 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
