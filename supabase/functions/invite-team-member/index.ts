import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extremely simple hashing for tokens
async function hashToken(token: string): Promise<string> {
  const messageBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', messageBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Unauthorized: Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      throw new Error('Unauthorized: Invalid token');
    }

    const { email, role, business_id, entity_ids } = await req.json();

    if (!email || !role || !business_id) {
      throw new Error('Missing required fields');
    }

    // Verify caller is admin or owner of business
    const { data: callerMember } = await supabaseAdmin
      .from('business_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('business_id', business_id)
      .single();

    if (!callerMember || (callerMember.role !== 'owner' && callerMember.role !== 'admin')) {
      throw new Error('Permission denied: You must be an owner or admin to invite members.');
    }

    // Generate secure token
    const rawToken = crypto.randomUUID();
    const tokenHash = await hashToken(rawToken);

    // Expiration: 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Insert invitation
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('business_invitations')
      .insert({
        business_id,
        email,
        role,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id
      })
      .select('id')
      .single();

    if (inviteError) {
      throw new Error('Failed to create invitation: ' + inviteError.message);
    }

    // Insert entity access restrictions if provided
    if (entity_ids && Array.isArray(entity_ids) && entity_ids.length > 0) {
      const entityAccessRecords = entity_ids.map(entity_id => ({
        invitation_id: invitation.id,
        entity_id
      }));

      const { error: entityError } = await supabaseAdmin
        .from('invitation_entity_access')
        .insert(entityAccessRecords);

      if (entityError) {
        // Rollback is manual here since we don't have transaction support in REST
        await supabaseAdmin.from('business_invitations').delete().eq('id', invitation.id);
        throw new Error('Failed to attach entity access: ' + entityError.message);
      }
    }

    // In a real app, send an email via Resend, Sendgrid, etc.
    // For now, we will just return the raw token back so the frontend can display it in dev mode
    // DO NOT DO THIS IN PRODUCTION unless it's a one-time copy-paste link

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation created',
        _dev_only_link: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/app/invite?token=${rawToken}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
