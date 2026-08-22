// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { communication_id } = await req.json();

    if (!communication_id) {
      throw new Error("Missing communication_id");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // We use service key for db updates, but verify user first
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await anonClient.auth.getUser(jwt);
    if (userError || !user) throw new Error(`Unauthorized: ${userError?.message || 'No user found'}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch communication
    const { data: comm, error: commError } = await adminClient
      .from('communications')
      .select('*, businesses(timezone)')
      .eq('id', communication_id)
      .single();

    if (commError || !comm) throw new Error('Communication not found');
    
    if (comm.direction !== 'inbound') {
      return new Response(JSON.stringify({ success: true, message: "Outbound communication skipped" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call AI
    const aiProvider = Deno.env.get('AI_PROVIDER') || 'gemini';
    const apiKey = Deno.env.get('AI_API_KEY')?.trim().replace(/^["']|["']$/g, '');
    const model = Deno.env.get('AI_MODEL') || 'gemini-1.5-flash';

    if (!apiKey) throw new Error("AI_API_KEY is not set");

    const systemPrompt = `You are a professional accounts receivable AI assistant. 
Analyze the following customer email related to an invoice.

Extract strict JSON (no markdown, no backticks) with this schema:
{
  "category": "payment_promise" | "payment_confirmation" | "dispute" | "document_request" | "general_inquiry",
  "confidence": <number 0.0 to 1.0>,
  "summary": "Concise 1 sentence summary of the email",
  "promise": {
    "detected": true|false,
    "date": "YYYY-MM-DD" (if detected and clear),
    "amount": <number> (if specified, otherwise null)
  }
}

Important Context:
Email Date: ${comm.sent_at}
Business Timezone: ${comm.businesses.timezone || 'UTC'}`;

    const textToAnalyze = `Subject: ${comm.subject}\n\n${comm.body_text}`;

    let aiResultText = "";

    if (aiProvider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + "\n\nEmail Text:\n" + textToAnalyze }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`Gemini error: ${errData.error?.message || response.statusText}`);
      }
      const data = await response.json();
      aiResultText = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error(`Unsupported AI provider: ${aiProvider}`);
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(aiResultText);
    } catch (e) {
      throw new Error("AI returned malformed JSON");
    }

    // Update communication
    await adminClient.from('communications').update({
      category: parsedJson.category,
      category_confidence: parsedJson.confidence,
      ai_summary: parsedJson.summary
    }).eq('id', communication_id);

    // If promise detected, insert promise
    if (parsedJson.promise?.detected && parsedJson.confidence >= 0.8 && comm.invoice_id) {
      await adminClient.from('payment_promises').insert({
        business_id: comm.business_id,
        invoice_id: comm.invoice_id,
        promised_date: parsedJson.promise.date || new Date().toISOString(), // Fallback if AI didn't extract exact date but detected promise
        amount: parsedJson.promise.amount,
        status: 'active',
        created_by: user.id
      });
    }
    
    // If dispute or payment confirmation, we might want to update the invoice status,
    // but the prompt says to trigger risk recalculation. The Risk Engine cron handles that.
    
    return new Response(JSON.stringify({ success: true, data: parsedJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in analyze-communication:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
