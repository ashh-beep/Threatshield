import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';

export function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Check for URL parameters (tokens from redirect)
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        // Display friendly error on page instead of redirecting
        setError(errorParam);
        setShowError(true);
        return;
      }

      if (accessToken && refreshToken) {
        try {
          // Store tokens
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', refreshToken);
          
          // Fetch user info to get role and redirect accordingly
          await refreshUser();
          
          // Redirect based on role
          setTimeout(() => {
            if (user) {
              switch (user.role) {
                case 'super_admin':
                  navigate('/threatshield-admin');
                  break;
                case 'org_admin':
                  navigate('/org-admin');
                  break;
                default:
                  navigate('/dashboard');
              }
            } else {
              navigate('/dashboard');
            }
          }, 100);
        } catch {
          setError('SSO authentication failed. Please try again.');
          setShowError(true);
        }
        return;
      }

      // Fallback: listen for postMessage (popup flow)
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'GATEKEEPER_SSO_SUCCESS') {
          const { accessToken, refreshToken } = event.data;
          try {
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
            refreshUser();
            setTimeout(() => {
              if (user) {
                switch (user.role) {
                  case 'super_admin':
                    navigate('/threatshield-admin');
                    break;
                  case 'org_admin':
                    navigate('/org-admin');
                    break;
                  default:
                    navigate('/dashboard');
                }
              } else {
                navigate('/dashboard');
              }
            }, 100);
          } catch {
            setError('SSO authentication failed. Please try again.');
            setShowError(true);
          }
        } else if (event.data.type === 'GATEKEEPER_SSO_ERROR') {
          setError(event.data.error || 'SSO failed');
          setShowError(true);
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    };

    handleCallback();
  }, [searchParams, refreshUser, navigate, user]);

  // Display friendly error for group assignment failure
  if (showError && error) {
    const isGroupError = error.includes('not assigned to any ThreatShield group') || error.includes('group');
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card variant="elevated" className="w-full max-w-md">
          <CardContent className="pt-0 text-center py-12">
            <div className="mx-auto mb-6 w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
            {isGroupError ? (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  You are not assigned to any ThreatShield security group in Microsoft Entra ID.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Please contact your IT administrator to be added to one of the following groups:
                </p>
                <div className="text-left text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="font-medium">TS_Super_Admins</p>
                  <p className="font-medium">TS_Org_Admins</p>
                  <p className="font-medium">TS_Users</p>
                </div>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Return to Login
                </Button>
              </>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Return to Login
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent className="pt-0 text-center py-12">
          <div className="mx-auto mb-6 w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <svg className="animate-spin w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Completing Sign In</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we redirect you to your dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}