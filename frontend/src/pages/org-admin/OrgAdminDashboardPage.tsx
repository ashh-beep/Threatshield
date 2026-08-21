import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminDashboardPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<{
    organization: any;
    statistics: {
      total_users: number;
      active_users: number;
      provisioned_users: number;
      deprovisioned_users: number;
      sso_users: number;
      password_users: number;
      email_auth_users: number;
    };
    recent_activity: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      const response = await api.getOrgAdminDashboard();
      setDashboardData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const orgName = user?.memberships?.[0]?.organization?.name || 'Organization';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => (
              <Card key={i} variant="outlined" className="border-gray-200 dark:border-gray-700">
                <CardContent className="pt-0 text-center py-4">
                  <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load dashboard</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <Button variant="primary" onClick={fetchDashboard}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.statistics || {
    total_users: 0,
    active_users: 0,
    provisioned_users: 0,
    deprovisioned_users: 0,
    sso_users: 0,
    password_users: 0,
    email_auth_users: 0,
  };
  const activity = dashboardData?.recent_activity || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                {orgName} Dashboard
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Organization administration overview
              </p>
            </div>
            <Badge variant="warning" size="md" dot>Organization Admin</Badge>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-8">
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Users</div>
            </CardContent>
          </Card>
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-8">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.active_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Users</div>
            </CardContent>
          </Card>
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-8">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.provisioned_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Provisioned</div>
            </CardContent>
          </Card>
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-8">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.deprovisioned_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Deprovisioned</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-6">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.sso_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">SSO Users</div>
            </CardContent>
          </Card>
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-6">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.password_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Password Users</div>
            </CardContent>
          </Card>
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-6">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.email_auth_users}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Email Auth Users</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/org-admin/users">
                  <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <CardContent className="pt-0 text-center py-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Manage Users</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Add, edit, provision users</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/org-admin/provisioning">
                  <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <CardContent className="pt-0 text-center py-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Provisioning</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Bulk provision/deprovision</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/org-admin/authentication">
                  <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <CardContent className="pt-0 text-center py-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Authentication</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Configure auth methods</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/org-admin/activity">
                  <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                    <CardContent className="pt-0 text-center py-4">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Activity</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">View organization activity</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {activity.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.slice(0, 5).map((a) => (
                    <div key={a.id} className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
                        </div>
                        <Badge variant="success" size="sm">{a.type.replace(/_/g, ' ').toUpperCase()}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}