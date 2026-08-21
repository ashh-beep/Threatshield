import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register({ email, password, first_name: firstName, last_name: lastName });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    // Microsoft SSO - Coming Soon (placeholder for future integration)
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6 w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Start scanning URLs with Gatekeeper</p>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Microsoft SSO Button - Coming Soon */}
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={handleMicrosoftLogin}
            disabled
            className="py-3 gap-2 mb-6 opacity-50 cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M21.5 10.8c0 3.2-1 4.3-3.3 4.3-2.6 0-2.8-1.7-3.5-2.2l-1.5.6c.5 1.2 2.1 2.2 4.6 2.2 4.9 0 7.6-3.3 7.6-7.8 0-4.5-3.5-7.5-8.7-7.5-2.1 0-3.6.9-4.3 1.5l-1.1-1.1C10.2 2.5 12.7 1.2 15.5 1.2c5.9 0 9.4 4.2 9.4 9.6 0 .6-.1 1.3-.2 1.9zm-18.2 3.2c0-2.9 3.1-4.3 5.7-4.3 1.8 0 2.9.9 2.9 2.1 0 1.5-1.6 2.4-3.6 2.8l-1.5.5c1.1.6 1.9 1.4 1.9 2.5 0 3.3-3.9 4.7-7.5 4.7-4.1 0-6.8-2.5-6.8-7.1 0-2.9 1.5-3.7 3.3-4.1l1.5.6c-.3 1-1.5 1.8-1.5 3.1 0 3.3 3.1 4.8 6.8 4.8 5.1 0 8.3-4.3 8.3-9.6 0-.6-.1-1.3-.2-1.9H3.6v.9c0 2.8 1.4 4.7 3.7 5.4L3.3 24h5.7c-.7-2.9-2.1-4.9-2.1-6.8z"/>
            </svg>
            <span>Continue with Microsoft (Coming Soon)</span>
          </Button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
            Microsoft Entra ID integration coming soon
          </p>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                OR
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300" role="alert">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First Name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
                autoComplete="given-name"
                autoFocus
              />
              <Input
                label="Last Name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                autoComplete="family-name"
              />
            </div>

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              helperText="At least 8 characters"
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />

            <Button type="submit" variant="primary" fullWidth loading={isLoading} className="py-3">
              Create account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}