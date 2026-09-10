import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ShieldCheck, ShieldAlert, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

export function SecuritySettings() {
  const [factors, setFactors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);

  const fetchFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load MFA factors');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFactors();
  }, []);

  const handleEnroll = async () => {
    setIsEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) throw error;
      
      setFactorId(data.id);
      setQrCode(data.totp.uri);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start enrollment');
      setIsEnrolling(false);
    }
  };

  const handleVerify = async () => {
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });
      
      if (verify.error) throw verify.error;

      toast.success('MFA successfully enabled!');
      setQrCode('');
      setFactorId('');
      setVerifyCode('');
      setIsEnrolling(false);
      fetchFactors();
    } catch (err: any) {
      toast.error(err.message || 'Verification failed. Please check your code.');
    }
  };

  const handleUnenroll = async (id: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast.success('MFA factor removed');
      fetchFactors();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove MFA factor');
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Successfully signed out of all other sessions');
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign out other sessions');
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  const isEnrolled = factors.length > 0;

  return (
    <div className="space-y-8">
      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-neutral-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                Multi-Factor Authentication (MFA)
              </h3>
              <div className="mt-2 max-w-xl text-sm text-neutral-500">
                <p>Protect your account with an extra layer of security using an authenticator app.</p>
              </div>
            </div>
            {!isLoading && !isEnrolled && !isEnrolling && (
              <Button onClick={handleEnroll}>Enable MFA</Button>
            )}
          </div>

          {isLoading && (
            <div className="mt-6 flex items-center text-sm text-neutral-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading security settings...
            </div>
          )}

          {!isLoading && isEnrolled && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-green-400" aria-hidden="true" />
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-green-700">
                    MFA is currently active for your account.
                  </p>
                  <p className="mt-2 text-sm md:mt-0 md:ml-6">
                    <button
                      onClick={() => handleUnenroll(factors[0].id)}
                      className="whitespace-nowrap font-medium text-green-700 hover:text-green-600"
                    >
                      Disable MFA
                    </button>
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && isEnrolling && qrCode && (
            <div className="mt-6 border border-neutral-200 rounded-md p-6 bg-neutral-50">
              <h4 className="font-medium text-neutral-900 mb-4">Setup Authenticator</h4>
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="bg-white p-4 rounded-md shadow-sm border border-neutral-100">
                  <QRCodeSVG value={qrCode} size={160} />
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-neutral-600">
                    1. Scan this QR code with your authenticator app (like Google Authenticator, Authy, or 1Password).
                  </p>
                  <p className="text-sm text-neutral-600">
                    2. Enter the 6-digit verification code generated by the app to confirm setup.
                  </p>
                  <div className="flex items-center gap-3">
                    <Input 
                      placeholder="000000" 
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      maxLength={6}
                      className="max-w-[150px] text-center tracking-widest font-mono"
                    />
                    <Button onClick={handleVerify} disabled={verifyCode.length < 6}>
                      Verify & Enable
                    </Button>
                    <Button variant="ghost" onClick={() => {
                      setIsEnrolling(false);
                      setQrCode('');
                    }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg border border-neutral-200 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-neutral-900 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-neutral-600" />
                Active Sessions
              </h3>
              <div className="mt-2 max-w-xl text-sm text-neutral-500">
                <p>If you've left your account logged in on another device, you can sign out of all other sessions.</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={handleSignOutOthers}
              disabled={isSigningOutOthers}
            >
              {isSigningOutOthers ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Sign out everywhere else
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
