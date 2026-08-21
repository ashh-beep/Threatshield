import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminSettingsPage() {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<any>(null);
  const [authConfig, setAuthConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const orgId = user?.memberships?.[0]?.organization_id;
      if (!orgId) throw new Error('No organization found');

      const [orgRes, authRes] = await Promise.all([
        api.getOrganization(orgId),
        api.orgAdminGetAuthConfig(),
      ]);
      setOrganization(orgRes.organization);
      setAuthConfig(authRes.auth_config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0">
              <div className="h-8 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Card variant="outlined" className="border-red-200 dark:border-red-800">
            <CardContent className="pt-0 text-center py-12">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load settings</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <Button variant="primary" onClick={fetchData}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const orgName = organization?.name || user?.memberships?.[0]?.organization?.name || 'Organization';
  const orgSlug = organization?.slug || '—';
  const orgId = organization?.id || user?.memberships?.[0]?.organization_id || '—';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Settings
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Organization settings and configuration
              </p>
            </div>
            <Badge variant="warning" size="md" dot>Organization Admin</Badge>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Organization Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Organization Name</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {orgName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Organization Slug</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm">
                  {orgSlug}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Organization ID</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-mono text-sm text-gray-900 dark:text-gray-100">
                  {orgId}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Domain</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {organization?.domain || 'Not configured'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                <Badge variant={organization?.status === 'active' ? 'success' : organization?.status === 'inactive' ? 'default' : 'danger'} size="md" dot>
                  {organization?.status || 'Active'}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Created</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {organization?.created_at ? new Date(organization.created_at).toLocaleDateString() : '—'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Admin Email</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {user?.email}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Authentication Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email + Password</label>
                <div className="flex items-center gap-3">
                  <Badge variant={authConfig?.password_enabled ? 'success' : 'default'} size="md" dot>
                    {authConfig?.password_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">SSO</label>
                <div className="flex items-center gap-3">
                  <Badge variant={authConfig?.sso_enabled ? (authConfig?.configured ? 'success' : 'warning') : 'default'} size="md" dot>
                    {authConfig?.sso_enabled ? (authConfig?.configured ? 'Configured' : 'Enabled (Not Configured)') : 'Disabled'}
                  </Badge>
                </div>
                {authConfig?.sso_provider && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Provider: {authConfig.sso_provider}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Authentication</label>
                <div className="flex items-center gap-3">
                  <Badge variant={authConfig?.email_auth_enabled ? 'success' : 'default'} size="md" dot>
                    {authConfig?.email_auth_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {authConfig?.email_auth_domain && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Domain: {authConfig.email_auth_domain}</p>
                )}
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" onClick={() => window.location.href = '/org-admin/authentication'}>
                  Configure Authentication
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <a href="/org-admin/users" className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Manage Users</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Add, edit, provision users</p>
                </a>
                <a href="/org-admin/provisioning" className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Provisioning</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Bulk provision/deprovision</p>
                </a>
                <a href="/org-admin/authentication" className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Authentication</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Configure auth methods</p>
                </a>
                <a href="/org-admin/activity" className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Activity</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View organization activity</p>
                </a>
                <a href="/org-admin/dashboard" className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Dashboard</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Overview & statistics</p>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}