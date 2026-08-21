import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { Card, CardContent } from '@components/ui/Card';
import { classNames } from '@utils/helpers';

export function SSOCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GATEKEEPER_SSO_SUCCESS') {
        const { accessToken, refreshToken } = event.data;
        try {
          // Store tokens and fetch user
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', refreshToken);
          await login('', ''); // This will trigger a user fetch via the auth context
          navigate('/dashboard');
        } catch {
          navigate('/login?error=sso_failed');
        }
      } else if (event.data.type === 'GATEKEEPER_SSO_ERROR') {
        navigate(`/login?error=${encodeURIComponent(event.data.error || 'SSO failed')}`);
      }
    };

    window.addEventListener('message', handleMessage);

    // Also check for URL parameters (fallback)
    const error = searchParams.get('error');
    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [searchParams, login, navigate]);

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