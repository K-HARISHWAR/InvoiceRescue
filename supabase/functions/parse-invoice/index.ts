// @ts-nocheck
// This file is a Supabase Edge Function (Deno), not a standard Node.js file. 
// We use @ts-nocheck to silence false-positive VS Code TypeScript errors since 
// the workspace is configured for React/Node.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode } from "https://deno.land/std@0.192.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { storage_path, mime_type } = await req.json();

    if (!storage_path) {
      throw new Error("Missing storage_path");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    );

    // 1. Download the file
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('invoice-documents')
      .download(storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download document: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    let contentToAnalyze: any = null;

    // 2. Prepare content for AI
    if (mime_type === 'application/pdf' || mime_type?.startsWith('image/')) {
      const base64 = encode(buffer);
      contentToAnalyze = {
        type: "inline_data",
        mime_type: mime_type,
        data: base64
      };
    } else {
      throw new Error(`Unsupported mime type: ${mime_type}`);
    }

    // 3. Call AI API
    const aiProvider = Deno.env.get('AI_PROVIDER') || 'openai';
    const apiKey = Deno.env.get('AI_API_KEY');
    const model = Deno.env.get('AI_MODEL') || 'gpt-4o';

    if (!apiKey) {
      throw new Error("AI_API_KEY is not set in edge function secrets");
    }

    const systemPrompt = `You are an expert AI invoice parser. 
Extract the following information from the invoice document. 
Return ONLY a strict JSON object (no markdown, no backticks, no explanations) matching this schema exactly:
{
  "invoice_number": "string or null",
  "customer_name": "string or null",
  "customer_email": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "payment_terms_days": "number or null",
  "currency": "3-letter code, e.g. INR, USD or null",
  "subtotal": "number or null",
  "tax_amount": "number or null",
  "total_amount": "number or null",
  "purchase_order": "string or null",
  "confidence": "number between 0 and 1 overall confidence",
  "field_confidence": {
    "invoice_number": "number 0-1",
    "customer_name": "number 0-1"
  },
  "warnings": ["array of warning strings if something looks suspicious or illegible"]
}

Rules:
- Extract rather than hallucinate; return null when information is absent.
- Preserve invoice number exactly.
- Preserve currency.
- Preserve decimal amounts.
- Distinguish subtotal/tax/total.
- Never invent customer email, PO number, or due date.`;

    let aiResultText = "";

    if (aiProvider === 'gemini') {
      const contents = [{
        parts: [
          { text: systemPrompt + "\n\nHere is the invoice document. Please parse it." },
          {
            inline_data: {
              mime_type: contentToAnalyze.mime_type,
              data: contentToAnalyze.data
            }
          }
        ]
      }];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contents,
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

    return new Response(JSON.stringify({ success: true, data: parsedJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error in parse-invoice:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: {
        code: "INVOICE_PARSE_FAILED",
        message: error.message
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
