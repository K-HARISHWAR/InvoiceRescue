import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, session, refreshBusinessContext } = useSession();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'auth_required'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    async function processInvite() {
      if (processingRef.current) return;
      
      if (!token) {
        setStatus('error');
        setErrorMessage('Invalid invitation link. No token provided.');
        return;
      }

      if (!session || !user) {
        setStatus('auth_required');
        return;
      }

      processingRef.current = true;

      try {
        // Hash the plaintext token provided in the URL locally to match the DB
        const messageBuffer = new TextEncoder().encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', messageBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const { data, error } = await supabase.rpc('accept_invitation', {
          p_token_hash: tokenHash,
          p_user_id: user.id
        });

        if (error) throw error;
        if (!data?.success) throw new Error('Failed to process invitation');

        setBusinessId(data.business_id);
        setStatus('success');
        
        // Refresh global session context to pull in new membership
        await refreshBusinessContext();

      } catch (err: any) {
        console.error('Accept invite error:', err);
        setStatus('error');
        setErrorMessage(err.message || 'The invitation is invalid, expired, or has already been used.');
      }
    }

    processInvite();
  }, [token, session, user, refreshBusinessContext]);

  if (status === 'auth_required') {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900">
            Accept Invitation
          </h2>
          <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <p className="text-neutral-600 mb-6">
              You need to sign in or create an account to accept this invitation.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate(`/login?returnTo=${encodeURIComponent(`/app/invite?token=${token}`)}`)}>
                Log In
              </Button>
              <Button onClick={() => navigate(`/signup?returnTo=${encodeURIComponent(`/app/invite?token=${token}`)}`)}>
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-neutral-900">
          Workspace Invitation
        </h2>
        
        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <p className="text-neutral-600">Verifying invitation...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-neutral-900 mb-2">Welcome to the team!</h3>
              <p className="text-neutral-600 mb-6">
                Your invitation has been accepted successfully. You now have access to the workspace.
              </p>
              <Button onClick={() => {
                // Ensure the context actually switches to the new business
                if (businessId) {
                  localStorage.setItem('invoiceRescue_activeBusinessId', businessId);
                }
                navigate('/app/dashboard');
                window.location.reload(); // hard reload to guarantee clean state
              }}>
                Go to Dashboard
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center">
              <XCircle className="h-16 w-16 text-red-500 mb-4" />
              <h3 className="text-xl font-medium text-neutral-900 mb-2">Invitation Failed</h3>
              <p className="text-neutral-600 mb-6">{errorMessage}</p>
              <Button variant="outline" onClick={() => navigate('/app/dashboard')}>
                Return to App
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
