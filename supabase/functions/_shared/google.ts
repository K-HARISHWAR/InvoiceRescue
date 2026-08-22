// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export async function decryptToken(encryptedToken: string, secret: string) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const decoded = atob(encryptedToken);
  const buffer = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) buffer[i] = decoded.charCodeAt(i);

  const salt = buffer.slice(0, 16);
  const iv = buffer.slice(16, 28);
  const data = buffer.slice(28);

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

export async function encryptToken(token: string, secret: string) {
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

export async function getValidAccessToken(supabaseClient: any, businessId: string, tokenEncryptionKey: string, clientId: string, clientSecret: string) {
  const { data: connection, error } = await supabaseClient
    .from('gmail_connections')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'connected')
    .single();

  if (error || !connection) {
    throw new Error('No active Gmail connection found for this business.');
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();

  // If token is valid for at least another 5 minutes
  if (expiresAt > now + 5 * 60 * 1000) {
    return await decryptToken(connection.encrypted_access_token, tokenEncryptionKey);
  }

  // Token is expired or about to expire, we need to refresh it
  if (!connection.encrypted_refresh_token) {
    await supabaseClient.from('gmail_connections').update({ status: 'error' }).eq('id', connection.id);
    throw new Error('Refresh token is missing. Please reconnect Gmail.');
  }

  const refreshToken = await decryptToken(connection.encrypted_refresh_token, tokenEncryptionKey);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    await supabaseClient.from('gmail_connections').update({ status: 'error' }).eq('id', connection.id);
    throw new Error(`Failed to refresh token: ${tokenData.error_description || tokenData.error}`);
  }

  const newAccessToken = tokenData.access_token;
  const encAccessToken = await encryptToken(newAccessToken, tokenEncryptionKey);
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // Update in DB
  await supabaseClient.from('gmail_connections').update({
    encrypted_access_token: encAccessToken,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString()
  }).eq('id', connection.id);

  return newAccessToken;
}

export async function sendGmailMessage(accessToken: string, to: string, subject: string, textBody: string, from?: string) {
  // Construct raw RFC 2822 email
  const emailLines = [];
  if (from) emailLines.push(`From: ${from}`);
  emailLines.push(`To: ${to}`);
  emailLines.push(`Subject: ${subject}`);
  emailLines.push('Content-Type: text/plain; charset="UTF-8"');
  emailLines.push('');
  emailLines.push(textBody);
  
  const emailStr = emailLines.join('\r\n');
  const encodedEmail = btoa(emailStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedEmail })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Gmail API error: ${data.error?.message || 'Unknown error'}`);
  }

  return data;
}
