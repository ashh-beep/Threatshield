import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { api, type Organization } from '@services/api';

export function SuperAdminProvisioningPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    try {
      const response = await api.adminListOrganizations({ per_page: 100 });
      setOrganizations(response.organizations);
      if (response.organizations.length > 0 && !selectedOrgId) {
        setSelectedOrgId(response.organizations[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Provisioning
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Provision client organizations and administrators
              </p>
            </div>
            <Link to="/threatshield-admin/create-client">
              <Button variant="primary">Create Client</Button>
            </Link>
          </div>
        </header>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="mt-1 h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : organizations.length === 0 ? (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No client organizations available for provisioning</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create a client organization first to provision administrators and settings</p>
              <Link to="/threatshield-admin/create-client">
                <Button variant="primary">Create Client</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Select Organization</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => setSelectedOrgId(org.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedOrgId === org.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-300 dark:border-indigo-700'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{org.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{org.slug}</p>
                        </div>
                        <Badge
                          variant={org.status === 'active' ? 'success' : org.status === 'inactive' ? 'default' : 'danger'}
                          size="sm"
                          dot
                        >
                          {org.status}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              {selectedOrgId && (
                <>
                  <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg">Provisioning Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Link to={`/threatshield-admin/create-admin?org_id=${selectedOrgId}`}>
                          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors h-full">
                            <CardContent className="pt-0 text-center py-6">
                              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Create Admin</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Provision organization administrator</p>
                            </CardContent>
                          </Card>
                        </Link>

                        <Link to={`/threatshield-admin/organizations/${selectedOrgId}`}>
                          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors h-full">
                            <CardContent className="pt-0 text-center py-6">
                              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Manage Organization</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">View and configure organization settings</p>
                            </CardContent>
                          </Card>
                        </Link>

                        <Link to="/threatshield-admin/create-admin">
                          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors h-full">
                            <CardContent className="pt-0 text-center py-6">
                              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Create New Client</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Provision a new client organization</p>
                            </CardContent>
                          </Card>
                        </Link>

                        <Link to="/threatshield-admin/organizations">
                          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors h-full">
                            <CardContent className="pt-0 text-center py-6">
                              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">All Organizations</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Manage all client organizations</p>
                            </CardContent>
                          </Card>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg">Selected Organization Details</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {organizations.find(o => o.id === selectedOrgId) && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{organizations.find(o => o.id === selectedOrgId)!.name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Slug</p>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{organizations.find(o => o.id === selectedOrgId)!.slug}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Domain</p>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{organizations.find(o => o.id === selectedOrgId)!.domain || '—'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                            <Badge variant={organizations.find(o => o.id === selectedOrgId)!.status === 'active' ? 'success' : 'default'} size="sm" dot>
                              {organizations.find(o => o.id === selectedOrgId)!.status}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">SSO</p>
                            <Badge variant={organizations.find(o => o.id === selectedOrgId)!.sso_configured ? 'success' : 'default'} size="sm" dot>
                              {organizations.find(o => o.id === selectedOrgId)!.sso_configured ? 'Configured' : 'Not Configured'}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{new Date(organizations.find(o => o.id === selectedOrgId)!.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}