import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';
import { classNames } from '@utils/helpers';

export function SuperAdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showOrgAdminModal, setShowOrgAdminModal] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    users: { total: number; active: number };
    organizations: { total: number; active: number };
    scans: { total: number; by_verdict: Record<string, number> };
    organizations_by_status: Record<string, number>;
    recent_users: Array<{ id: string; email: string; first_name: string; last_name: string; role: string; is_active: boolean; created_at: string }>;
    recent_organizations: Array<{ id: string; name: string; slug: string; status: string; created_at: string }>;
    recent_scans: Array<{ id: string; url: string; verdict: string; risk_score: number; created_at: string }>;
  } | null>(null);
  const [systemStats, setSystemStats] = useState<{
    totals: { users: number; organizations: number; scans: number; memberships: number };
    users_by_role: Record<string, number>;
    organizations_by_status: Record<string, number>;
    scans_by_verdict: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.getAdminDashboard();
      setDashboardData(response);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    }
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await api.getAdminStats();
      setSystemStats(response);
    } catch (err) {
      console.error('Failed to fetch system stats:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      await Promise.all([fetchDashboard(), fetchSystemStats()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchSystemStats]);

  const orgCount = dashboardData?.organizations.total ?? systemStats?.totals.organizations ?? 0;
  const adminCount = systemStats?.users_by_role.org_admin ?? 0;
  const userCount = dashboardData?.users.total ?? systemStats?.totals.users ?? 0;
  const activeOrgCount = dashboardData?.organizations.active ?? systemStats?.organizations_by_status.active ?? 0;

  const handleOrgAdminClick = () => {
    if (user?.role === 'super_admin') {
      setShowOrgAdminModal(true);
    } else if (user?.role === 'org_admin') {
      navigate('/org-admin');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-4">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-4">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-4">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-4">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                ThreatShield Super Admin
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage client organizations, administrators, users and ThreatShield services.
              </p>
            </div>
            <Badge variant="danger" size="md" dot>Super Admin</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-8">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{orgCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Organizations</div>
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-8">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{adminCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Organization Admins</div>
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-8">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{userCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Users</div>
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-8">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{activeOrgCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Clients</div>
              </CardContent>
            </Card>
          </div>
        </header>

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/threatshield-admin/create-client">
              <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-0 text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Create Client</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">New organization</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/threatshield-admin/create-admin">
              <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-0 text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Create Admin</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Provision admin user</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/threatshield-admin/organizations">
              <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-0 text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Manage Organizations</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{orgCount} organizations</p>
                </CardContent>
              </Card>
            </Link>
            <Link to="/threatshield-admin/provisioning">
              <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-0 text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Provisioning</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Admin provisioning</p>
                </CardContent>
              </Card>
            </Link>
            <div className="cursor-pointer" onClick={handleOrgAdminClick}>
              <Card variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-0 text-center py-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Organization Admin</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Manage your organization</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activity</h2>
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No activity yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                When client organizations and administrators begin using ThreatShield, activity will appear here.
              </p>
              <Link to="/threatshield-admin/activity">
                <Button variant="primary">View Activity</Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {dashboardData && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Overview</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {dashboardData.recent_organizations && dashboardData.recent_organizations.length > 0 && (
                <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Recent Organizations</CardTitle>
                      <Link to="/threatshield-admin/organizations">
                        <Button variant="ghost" size="sm">View All</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {dashboardData.recent_organizations.slice(0, 5).map((org) => (
                        <Link key={org.id} to={`/threatshield-admin/organizations/${org.id}`} className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{org.name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{org.slug}</p>
                            </div>
                            <Badge 
                              variant={org.status === 'active' ? 'success' : org.status === 'inactive' ? 'default' : 'danger'} 
                              size="sm"
                            >
                              {org.status}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {dashboardData.recent_users && dashboardData.recent_users.length > 0 && (
                <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Recent Users</CardTitle>
                      <Link to="/threatshield-admin/admins">
                        <Button variant="ghost" size="sm">View All</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {dashboardData.recent_users.slice(0, 5).map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                {u.first_name?.[0] || u.email?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {u.first_name} {u.last_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={u.role === 'super_admin' ? 'danger' : u.role === 'org_admin' ? 'warning' : 'info'} size="sm" dot>
                              {u.role}
                            </Badge>
                            <Badge variant={u.is_active ? 'success' : 'default'} size="sm" dot>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {systemStats && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">System Analytics</h2>
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
              {[
                { key: 'active', label: 'Active', count: systemStats.organizations_by_status.active || 0, color: 'success' as const },
                { key: 'inactive', label: 'Inactive', count: systemStats.organizations_by_status.inactive || 0, color: 'default' as const },
                { key: 'suspended', label: 'Suspended', count: systemStats.organizations_by_status.suspended || 0, color: 'danger' as const },
              ].map((item) => (
                <Card key={item.key} variant="outlined" className={classNames('border-gray-200 dark:border-gray-700 text-center', item.color === 'success' && 'border-green-200 dark:border-green-800', item.color === 'default' && 'border-gray-200 dark:border-gray-700', item.color === 'danger' && 'border-red-200 dark:border-red-800')}>
                  <CardContent className="pt-0 py-6">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{item.count}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{item.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { key: 'safe', label: 'Safe', count: systemStats.scans_by_verdict.safe || 0, color: 'success' as const },
                { key: 'suspicious', label: 'Suspicious', count: systemStats.scans_by_verdict.suspicious || 0, color: 'warning' as const },
                { key: 'dangerous', label: 'Dangerous', count: systemStats.scans_by_verdict.dangerous || 0, color: 'danger' as const },
              ].map((item) => (
                <Card key={item.key} variant="outlined" className={classNames('border-gray-200 dark:border-gray-700 text-center', item.color === 'success' && 'border-green-200 dark:border-green-800', item.color === 'warning' && 'border-yellow-200 dark:border-yellow-800', item.color === 'danger' && 'border-red-200 dark:border-red-800')}>
                  <CardContent className="pt-0 py-6">
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{item.count}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{item.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      {showOrgAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowOrgAdminModal(false)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Organization Admin Portal</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Organization Admin portal requires an Organization Admin account.
              </p>
              <div className="flex gap-3">
                <Button variant="primary" className="flex-1" onClick={() => navigate('/threatshield-admin/organizations')}>
                  Go to Organizations
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowOrgAdminModal(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}