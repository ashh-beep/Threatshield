import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { api, type User } from '@services/api';

export function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<(User & { organization_name?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.adminListUsers({
        page: currentPage,
        per_page: 20,
        search,
        role: 'org_admin',
      });
      // Backend returns 'users' key, not 'data'
      const rawUsers = (response as { users?: typeof response.data }).users ?? [];
      const filteredAdmins = orgFilter
        ? rawUsers.filter((u) => u.memberships?.some((m) => m.organization_id === orgFilter))
        : rawUsers;
      const adminsWithOrg = filteredAdmins.map((u) => ({
        ...u,
        organization_name: u.memberships?.find((m) => !orgFilter || m.organization_id === orgFilter)?.organization?.name || '—',
      }));
      setAdmins(adminsWithOrg);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch admins');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, orgFilter]);

  const fetchOrgs = useCallback(async () => {
    try {
      const response = await api.adminListOrganizations({ per_page: 100 });
      return response.organizations;
    } catch {
      return [];
    }
  }, []);

  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  useEffect(() => {
    fetchAdmins();
    fetchOrgs().then(setOrgs);
  }, [fetchAdmins, fetchOrgs]);

  const handleToggleActive = async (adminId: string, currentStatus: boolean) => {
    setActionLoading(adminId);
    try {
      await api.adminUpdateUser(adminId, { is_active: !currentStatus });
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === adminId ? { ...a, is_active: !currentStatus } : a
        )
      );
    } catch (err) {
      console.error('Failed to update admin:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getAuthMethodBadge = (method: string) => {
    const variants: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
      sso: 'info',
      password: 'success',
      email_auth: 'warning',
    };
    return <Badge variant={variants[method] || 'default'} size="sm">{method}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Organization Admins
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage all organization administrators across the platform
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/threatshield-admin/create-admin">
                <Button variant="primary">Create Admin</Button>
              </Link>
              <Link to="/threatshield-admin/create-client">
                <Button variant="outline">Create Client</Button>
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search admins..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              className="max-w-xs px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Organizations</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>{org.name} ({org.slug})</option>
              ))}
            </select>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} variant="outlined" className="border-gray-200 dark:border-gray-700">
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
            ))}
          </div>
        ) : admins.length === 0 ? (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No organization admins yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first organization administrator</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/threatshield-admin/create-admin">
                  <Button variant="primary">Create Admin</Button>
                </Link>
                <Link to="/threatshield-admin/create-client">
                  <Button variant="outline">Create Client</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg">Organization Admins ({admins.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auth Method</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {admins.map((admin) => (
                        <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                  {admin.first_name?.[0] || admin.email?.[0]?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {admin.first_name} {admin.last_name}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {admin.email}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {admin.organization_name || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <Badge 
                              variant={admin.is_active ? 'success' : 'default'} 
                              size="sm" 
                              dot
                            >
                              {admin.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            {admin.auth_method && getAuthMethodBadge(admin.auth_method)}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(admin.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link to={`/threatshield-admin/admins/${admin.id}`}>
                                <Button variant="ghost" size="sm">View</Button>
                              </Link>
                              <Button
                                variant={admin.is_active ? 'outline' : 'primary'}
                                size="sm"
                                className={admin.is_active ? 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                                disabled={actionLoading === admin.id}
                                onClick={() => handleToggleActive(admin.id, admin.is_active)}
                              >
                                {actionLoading === admin.id ? (
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  admin.is_active ? 'Deactivate' : 'Reactivate'
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
        )}
      </div>
    </div>
  );
}