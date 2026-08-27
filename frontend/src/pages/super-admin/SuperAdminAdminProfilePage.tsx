import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import { api, type User, type ActivityLog, type Organization } from '@services/api';

interface MembershipWithOrg {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'member' | 'admin' | 'owner';
  joined_at: string;
  organization?: Pick<Organization, 'id' | 'name' | 'slug'>;
}

interface AdminProfileData extends Omit<User, 'memberships'> {
  memberships?: MembershipWithOrg[];
}

export function SuperAdminAdminProfilePage() {
  const { adminId } = useParams<{ adminId: string }>();
  const navigate = useNavigate();

  const [admin, setAdmin] = useState<AdminProfileData | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAdmin = useCallback(async () => {
    if (!adminId) return;
    try {
      const response = await api.superAdminGetAdmin(adminId);
      setAdmin(response.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin');
    }
  }, [adminId]);

  const fetchAdminActivity = useCallback(async () => {
    if (!adminId) return;
    setActivityLoading(true);
    try {
      const response = await api.getAdminActivity({
        page: currentPage,
        per_page: 20,
        user_id: adminId,
      });
      const responseData = response as { activity?: ActivityLog[]; pagination?: { pages: number } };
      const activitiesData = Array.isArray(responseData.activity) ? responseData.activity : [];
      setActivities(activitiesData);
      setTotalPages(responseData.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load admin activity:', err);
    } finally {
      setActivityLoading(false);
    }
  }, [adminId, currentPage]);

  useEffect(() => {
    fetchAdmin();
    fetchAdminActivity();
  }, [fetchAdmin, fetchAdminActivity]);

  useEffect(() => {
    setIsLoading(false);
  }, [admin]);

  const handleToggleActive = () => {
    if (!admin) return;
    navigate(`/threatshield-admin/admins/${admin.id}/toggle`);
  };

  const goBack = () => {
    navigate('/threatshield-admin/admins');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-6 p-4">
                  <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-3">
                    <div className="h-6 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !admin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Card variant="outlined" className="border-red-200 dark:border-red-800">
            <CardContent className="pt-0 text-center py-8">
              <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load admin</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Admin not found'}</p>
              <Button variant="primary" onClick={goBack}>Back to Admins</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (admin.is_provisioned === false) {
      return <Badge variant="danger" size="md" dot>Deprovisioned</Badge>;
    }
    if (!admin.is_active) {
      return <Badge variant="warning" size="md" dot>Inactive</Badge>;
    }
    return <Badge variant="success" size="md" dot>Active</Badge>;
  };

  const getAuthMethodBadge = (method: string) => {
    const variants: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
      sso: 'info',
      password: 'success',
      email_auth: 'warning',
    };
    return <Badge variant={variants[method] || 'default'} size="md">{method}</Badge>;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_invited':
        return (
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'user_invite_accepted':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'user_sso_login':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'user_deprovisioned':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'user_reactivated':
        return (
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'user_login':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        );
      case 'scan_created':
      case 'url_scanned':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'user_created':
      case 'user_provisioned':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
    }
  };

  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const primaryMembership = admin.memberships?.[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={goBack}>
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Admins
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => handleToggleActive()} disabled={admin.is_active && admin.is_provisioned === false}>
                {admin.is_active && admin.is_provisioned !== false ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
                {admin.first_name?.[0] || admin.last_name?.[0] || admin.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {admin.first_name} {admin.last_name}
                </h1>
                {getStatusBadge()}
                <Badge variant="info" size="md">Organization Admin</Badge>
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-400 font-mono text-sm">{admin.email}</p>
              {primaryMembership?.organization && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Organization: <span className="font-medium text-gray-900 dark:text-gray-100">{primaryMembership.organization.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">({primaryMembership.organization.slug})</span>
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Profile Details Grid */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Main Info */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</dt>
                  <dd className="mt-1 text-lg font-medium text-gray-900 dark:text-gray-100">{admin.first_name} {admin.last_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{admin.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">Organization Admin</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Authentication Method</dt>
                  <dd className="mt-1 flex items-center">{getAuthMethodBadge(admin.auth_method || 'password')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Provisioning Status</dt>
                  <dd className="mt-1">{getStatusBadge()}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Verified</dt>
                  <dd className="mt-1 flex items-center">
                    <Badge variant={admin.is_verified ? 'success' : 'warning'} size="sm" dot>
                      {admin.is_verified ? 'Verified' : 'Not Verified'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">
                    {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">
                    {admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Admin ID</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-sm">{admin.id}</dd>
                </div>
                {primaryMembership && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">
                      {primaryMembership.organization?.name} ({primaryMembership.organization?.slug})
                    </dd>
                  </div>
                )}
                {primaryMembership && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Org Role</dt>
                    <dd className="mt-1">
                      <Badge variant="info" size="sm">{primaryMembership.role}</Badge>
                    </dd>
                  </div>
                )}
                {primaryMembership && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Joined Org</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">
                      {primaryMembership.joined_at ? new Date(primaryMembership.joined_at).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Activities</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{activities.length + (currentPage > 1 ? (currentPage - 1) * 20 : 0)}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Account Status</p>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {admin.is_provisioned === false ? 'Deprovisioned' : admin.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Organizations</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{admin.memberships?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activityLoading ? (
              <div className="animate-pulse space-y-4 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No activity yet</h3>
                <p className="text-gray-600 dark:text-gray-400">This admin has not performed any tracked actions.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {activities.map((activity) => (
                        <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {(() => {
                              try {
                                return new Date(activity.created_at).toLocaleString();
                              } catch {
                                return 'Invalid date';
                              }
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {getActivityIcon(activity.type)}
                              <Badge variant="default" size="sm">
                                {formatActivityType(activity.type)}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {activity.description}
                            {activity.type === 'scan_created' && activity.metadata && (
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                {activity.metadata.url ? (
                                  <span className="font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-xs" title={String(activity.metadata.url)}>
                                    {String(activity.metadata.url)}
                                  </span>
                                ) : null}
                                {activity.metadata.verdict ? (
                                  <Badge 
                                    variant={String(activity.metadata.verdict) === 'safe' ? 'success' : String(activity.metadata.verdict) === 'suspicious' ? 'warning' : 'danger'} 
                                    size="sm"
                                  >
                                    {String(activity.metadata.verdict)}
                                  </Badge>
                                ) : null}
                                {activity.metadata.risk_score !== undefined ? (
                                  <Badge variant="default" size="sm" className="text-gray-600 dark:text-gray-400">
                                    Risk: {Number(activity.metadata.risk_score)}
                                  </Badge>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}