import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function SuperAdminCreateAdminPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get('org_id');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(orgId || '');

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const response = await api.adminListOrganizations({ per_page: 100 });
        setOrgs(response.organizations);
        if (orgId) setSelectedOrgId(orgId);
      } catch {
        // Ignore
      }
    };
    fetchOrgs();
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password || !firstName.trim() || !lastName.trim()) {
      setError('All fields are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!selectedOrgId) {
      setError('Please select an organization');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.adminCreateUser({
        email: email.trim().toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'org_admin',
        is_active: true,
        is_verified: true,
        organization_id: selectedOrgId,
      });

      setSuccess('Organization admin created successfully');
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');

      setTimeout(() => {
        navigate('/threatshield-admin/organizations');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Create Organization Admin
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Provision a new organization administrator
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300" role="alert">
            {success}
          </div>
        )}

        <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Admin Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                autoFocus
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First Name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                  autoComplete="given-name"
                  disabled={isSubmitting}
                />
                <Input
                  label="Last Name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  autoComplete="family-name"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Organization
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Select Organization</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <Button type="submit" variant="primary" loading={isSubmitting} className="flex-1">
                  Create Admin
                </Button>
                <Button variant="ghost" onClick={() => navigate(-1)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}