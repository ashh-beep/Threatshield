import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { useAuth } from '@context/AuthContext';
import { api, type Organization } from '@services/api';
import { classNames } from '@utils/helpers';

export function SuperAdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrganizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.adminListOrganizations({
        page: currentPage,
        per_page: 20,
        search,
        status: statusFilter,
      });
      setOrganizations(response.organizations);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Client Organizations
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage all client organizations across the platform
              </p>
            </div>
            <Link to="/threatshield-admin/create-client">
              <Button variant="primary">
                Create New Client
              </Button>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="max-w-xs px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </header>

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
        ) : organizations.length === 0 ? (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No organizations found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first client organization</p>
              <Link to="/threatshield-admin/create-client">
                <Button variant="primary">Create Client</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg">Organizations ({organizations.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Organization</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Domain</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SSO</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {organizations.map((org) => (
                          <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-4">
                              <Link to={`/threatshield-admin/organizations/${org.id}`} className="hover:underline">
                                <p className="font-medium text-gray-900 dark:text-gray-100">{org.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{org.slug}</p>
                              </Link>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {org.domain || '—'}
                            </td>
                            <td className="px-4 py-4">
                              <Badge 
                                variant={org.status === 'active' ? 'success' : org.status === 'inactive' ? 'default' : 'danger'} 
                                size="sm" 
                                dot
                              >
                                {org.status.charAt(0).toUpperCase() + org.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <Badge 
                                variant={org.sso_configured ? 'success' : 'default'} 
                                size="sm" 
                                dot
                              >
                                {org.sso_configured ? 'Configured' : 'Not Configured'}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(org.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Link to={`/threatshield-admin/organizations/${org.id}`}>
                                  <Button variant="ghost" size="sm">View</Button>
                                </Link>
                                <Link to={`/threatshield-admin/create-admin?org_id=${org.id}`}>
                                  <Button variant="outline" size="sm">Create Admin</Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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