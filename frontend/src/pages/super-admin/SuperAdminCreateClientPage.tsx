import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function SuperAdminCreateClientPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [domain, setDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required');
      return;
    }

    if (adminEmail && (!adminFirstName || !adminLastName || !adminPassword)) {
      setError('If providing admin email, first name, last name, and password are required');
      return;
    }

    if (adminPassword && adminPassword.length < 8) {
      setError('Admin password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create organization
      const orgResponse = await api.adminCreateOrganization({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        domain: domain.trim().toLowerCase() || undefined,
      });

      const orgId = orgResponse.organization.id;

      // Create admin user if provided
      if (adminEmail) {
        const adminResponse = await api.adminCreateUser({
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword,
          first_name: adminFirstName.trim(),
          last_name: adminLastName.trim(),
          role: 'org_admin',
          is_active: true,
          is_verified: true,
          organization_id: orgId,
        });

        // The adminCreateUser already assigns the user as admin of the org
        setSuccess('Organization and admin user created successfully');
      } else {
        setSuccess('Organization created successfully');
      }

      // Clear form
      setName('');
      setSlug('');
      setDomain('');
      setAdminEmail('');
      setAdminFirstName('');
      setAdminLastName('');
      setAdminPassword('');

      // Redirect after a short delay
      setTimeout(() => {
        navigate(`/threatshield-admin/organizations/${orgId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Create New Client
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Provision a new client organization and optionally create an organization admin
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
            <CardTitle className="text-lg">Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Organization Name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corporation"
                  required
                  disabled={isSubmitting}
                />
                <Input
                  label="Slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="acme-corp"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <Input
                label="Custom Domain (optional)"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acme.com"
                disabled={isSubmitting}
              />

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Organization Admin (Optional)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Create an organization administrator user. If left blank, you can add an admin later.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Admin Email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@acme.com"
                    disabled={isSubmitting}
                  />
                  <Input
                    label="Admin Password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    helperText="At least 8 characters"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First Name"
                    type="text"
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    placeholder="John"
                    disabled={isSubmitting}
                  />
                  <Input
                    label="Last Name"
                    type="text"
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    placeholder="Doe"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} className="flex-1">
            Create Client
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}