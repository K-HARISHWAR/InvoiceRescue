// @ts-nocheck
// This file is a Supabase Edge Function (Deno)

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
    const { action_id } = await req.json();

    if (!action_id) {
      throw new Error("Missing action_id");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    );

    // 1. Fetch action, invoice, customer, business
    const { data: action, error: actionError } = await supabaseClient
      .from('collection_actions')
      .select(`
        *,
        invoices (*, 
          customers (*),
          payment_promises (*)
        ),
        businesses (*)
      `)
      .eq('id', action_id)
      .single();

    if (actionError || !action) {
      throw new Error(`Failed to fetch action context: ${actionError?.message}`);
    }

    const invoice = action.invoices;
    const customer = invoice.customers;
    const business = action.businesses;
    const promises = invoice.payment_promises || [];

    // 2. Format context
    const contextStr = JSON.stringify({
      Business: business.name,
      Customer: customer.name,
      Invoice_number: invoice.invoice_number,
      Amount: invoice.total_amount,
      Outstanding: invoice.outstanding_amount,
      Currency: invoice.currency,
      Due_date: invoice.due_date,
      Days_overdue: Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 3600 * 24)),
      Collection_stage: invoice.collection_stage,
      Action_type: action.action_type,
      Recommended_reason: action.recommended_reason,
      Documented_payment_promises: promises
    }, null, 2);

    // 3. Call AI
    const aiProvider = Deno.env.get('AI_PROVIDER') || 'openai';
    const apiKey = Deno.env.get('AI_API_KEY');
    const model = Deno.env.get('AI_MODEL') || 'gpt-4o';

    if (!apiKey) {
      throw new Error("AI_API_KEY is not set in edge function secrets");
    }

    const systemPrompt = `You are a professional accounts receivable AI assistant. 
Draft a collection email based on the following invoice facts.

Drafting rules:
- remain professional;
- be concise;
- reference only verified facts provided below;
- use exact invoice number;
- use exact outstanding amount and currency;
- use exact dates;
- never invent payment promises;
- never claim legal consequences;
- never threaten;
- never claim that formal proceedings have begun unless explicitly stored as true;
- never fabricate interest/penalties.

Return ONLY a strict JSON object (no markdown, no backticks, no explanations) matching this schema exactly:
{
  "subject": "Email subject line",
  "body": "Email body text. Use \n for newlines."
}`;

    let aiResultText = "";

    if (aiProvider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt + "\n\nFacts:\n" + contextStr }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(`Gemini error: ${errData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      aiResultText = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error(`Unsupported AI provider: ${aiProvider}. Please use 'gemini'.`);
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(aiResultText);
    } catch (e) {
      throw new Error("AI returned malformed JSON");
    }

    // 4. Update the collection action with the draft
    const { error: updateError } = await supabaseClient
      .from('collection_actions')
      .update({
        draft_subject: parsedJson.subject,
        draft_body: parsedJson.body,
        status: 'draft',
        updated_at: new Date().toISOString()
      })
      .eq('id', action_id);

    if (updateError) {
      throw new Error(`Failed to save draft: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, data: parsedJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in generate-collection-draft:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: {
        code: "DRAFT_FAILED",
        message: error.message
      } 
    }), {
      status: 200, // Returning 200 to allow client side handling
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
