// @ts-nocheck
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

async function verifyState(encodedState: string, secret: string) {
  try {
    const stateObj = JSON.parse(atob(encodedState));
    if (!stateObj.b || !stateObj.u || !stateObj.sig) return null;
    
    const { sig, ...originalState } = stateObj;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const stateString = JSON.stringify(originalState);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(stateString));
    
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (hashHex !== sig) return null;
    return originalState;
  } catch (e) {
    return null;
  }
}

// Simple AES-GCM encryption for tokens
async function encryptToken(token: string, secret: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(token)
  );

  const encryptedArray = new Uint8Array(encryptedContent);
  const buffer = new Uint8Array(salt.length + iv.length + encryptedArray.length);
  buffer.set(salt, 0);
  buffer.set(iv, salt.length);
  buffer.set(encryptedArray, salt.length + iv.length);

  return btoa(String.fromCharCode.apply(null, buffer));
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  const appRedirectUrl = new URL('/app/settings', url.origin); // Assuming same origin for local, but prod might differ.
  // Better to use an env var for frontend URL if different, but let's assume it's hosted together or we just redirect to the origin.
  // Actually, VITE_SUPABASE_URL isn't the frontend URL. For this MVP, let's just use a hardcoded or env-provided frontend URL.
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';
  const finalRedirect = new URL('/app/settings', frontendUrl);

  if (errorParam) {
    finalRedirect.searchParams.set('error', 'Google OAuth was denied or failed');
    return Response.redirect(finalRedirect.toString(), 302);
  }

  if (!code || !state) {
    finalRedirect.searchParams.set('error', 'Missing code or state');
    return Response.redirect(finalRedirect.toString(), 302);
  }

  try {
    const tokenEncryptionKey = Deno.env.get('TOKEN_ENCRYPTION_KEY')?.trim().replace(/^["']|["']$/g, '');
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim().replace(/^["']|["']$/g, '');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim().replace(/^["']|["']$/g, '');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')?.trim().replace(/^["']|["']$/g, '');

    if (!clientId || !clientSecret || !redirectUri || !tokenEncryptionKey) {
      throw new Error("Missing Google OAuth configuration");
    }

    const verifiedState = await verifyState(state, tokenEncryptionKey);
    if (!verifiedState) {
      throw new Error("Invalid or expired state parameter");
    }

    const { b: business_id, u: user_id } = verifiedState;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed: ${tokenData.error_description || tokenData.error}`);
    }

    // We must get a refresh token for offline access
    if (!tokenData.refresh_token) {
      // Sometimes Google only sends it on the very first authorization.
      // If we don't have it, we might need to force re-consent, but let's assume we got it since we used prompt=consent
      console.warn("No refresh token received from Google. User might need to revoke access and try again.");
    }

    // Get user email
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userInfoResponse.json();

    if (!userInfo.email) {
      throw new Error("Failed to retrieve Google email address");
    }

    // Encrypt tokens
    const encAccessToken = await encryptToken(tokenData.access_token, tokenEncryptionKey);
    const encRefreshToken = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token, tokenEncryptionKey) : null;
    
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert into gmail_connections
    // We check if one exists for the business
    const { data: existing } = await supabaseClient
      .from('gmail_connections')
      .select('id, encrypted_refresh_token')
      .eq('business_id', business_id)
      .maybeSingle();

    const upsertData: any = {
      business_id,
      user_id,
      google_email: userInfo.email,
      encrypted_access_token: encAccessToken,
      token_expires_at: expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
      status: 'connected',
      updated_at: new Date().toISOString()
    };

    if (encRefreshToken) {
      upsertData.encrypted_refresh_token = encRefreshToken;
    } else if (!existing?.encrypted_refresh_token) {
      throw new Error("No refresh token available and none exists in database. Please disconnect and reconnect.");
    } else {
      // Keep existing refresh token if not provided in this response
      upsertData.encrypted_refresh_token = existing.encrypted_refresh_token;
    }

    if (existing) {
      await supabaseClient.from('gmail_connections').update(upsertData).eq('id', existing.id);
    } else {
      await supabaseClient.from('gmail_connections').insert([upsertData]);
    }

    finalRedirect.searchParams.set('success', 'Gmail connected successfully');
    return Response.redirect(finalRedirect.toString(), 302);

  } catch (error: any) {
    console.error("OAuth Callback Error:", error);
    finalRedirect.searchParams.set('error', error.message || 'An unknown error occurred');
    return Response.redirect(finalRedirect.toString(), 302);
  }
});
