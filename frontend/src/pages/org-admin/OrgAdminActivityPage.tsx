import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminActivityPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.orgAdminActivity({
        page: currentPage,
        per_page: 50,
        search,
      });
      setActivities(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const getActionBadge = (type: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      user_created: 'success',
      user_updated: 'info',
      user_deprovisioned: 'danger',
      user_provisioned: 'success',
      admin_user_updated: 'warning',
      auth_config_updated: 'info',
      org_created: 'success',
      org_updated: 'info',
      org_sso_configured: 'info',
      org_settings_updated: 'default',
      user_login: 'success',
      user_logout: 'default',
      user_register: 'success',
      user_sso_login: 'info',
      user_password_reset: 'warning',
    };
    return variants[type] || 'default';
  };

  const formatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Activity
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Monitor administrative activity for your organization
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </header>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} variant="outlined" className="border-gray-200 dark:border-gray-700">
                <CardContent className="pt-0">
                  <div className="p-4">
                    <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card variant="outlined" className="border-red-200 dark:border-red-800">
            <CardContent className="pt-0 text-center py-8">
              <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load activity</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <Button variant="primary" onClick={fetchActivity}>Retry</Button>
            </CardContent>
          </Card>
        ) : activities.length === 0 ? (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No activity yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Organization activity will appear here as users are created, provisioned, and configured.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity ({activities.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {activities.map((activity) => (
                        <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(activity.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {activity.user && (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                    {activity.user.first_name?.[0] || activity.user.email?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {activity.user ? `${activity.user.first_name} ${activity.user.last_name}` : 'System'}
                                </p>
                                {activity.user && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{activity.user.email}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={getActionBadge(activity.type)} size="sm">
                              {formatType(activity.type)}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {activity.description}
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="success" size="sm" dot>Completed</Badge>
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