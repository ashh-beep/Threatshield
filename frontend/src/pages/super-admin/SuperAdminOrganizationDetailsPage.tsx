import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import { Input } from '@components/ui/Input';
import { api, type Organization, type User, type ActivityLog } from '@services/api';

interface OrganizationDetail extends Organization {
  sso_config?: Record<string, unknown>;
  auth_config?: {
    password_enabled: boolean;
    sso_enabled: boolean;
    email_auth_enabled: boolean;
    sso_provider?: string;
    sso_client_id?: string;
    sso_tenant_id?: string;
    sso_issuer?: string;
    sso_redirect_url?: string;
    sso_domain?: string;
    sso_metadata_url?: string;
    email_auth_domain?: string;
  };
}

interface MemberWithUser {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'member' | 'admin' | 'owner';
  joined_at: string;
  user: User;
}

export function SuperAdminOrganizationDetailsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();

  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<{
    scans: { total: number; dangerous: number; suspicious: number; safe: number };
    members: { total: number; admins: number };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrg = useCallback(async () => {
    if (!organizationId) return;
    try {
      const response = await api.getOrganization(organizationId);
      setOrg(response.organization);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization');
    }
  }, [organizationId]);

  const fetchMembers = useCallback(async () => {
    if (!organizationId) return;
    setMembersLoading(true);
    try {
      const response = await api.listMembers(organizationId);
      setMembers(response.members || []);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setMembersLoading(false);
    }
  }, [organizationId]);

  const fetchStats = useCallback(async () => {
    if (!organizationId) return;
    setStatsLoading(true);
    try {
      const response = await api.getOrgStats(organizationId);
      setStats(response);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [organizationId]);

  const fetchActivities = useCallback(async () => {
    if (!organizationId) return;
    setActivitiesLoading(true);
    try {
      const response = await api.getOrgActivity(organizationId, {
        page: currentPage,
        per_page: 20,
      });
      const activitiesData = (response as { activity?: ActivityLog[] }).activity || [];
      setActivities(activitiesData);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setActivitiesLoading(false);
    }
  }, [organizationId, currentPage]);

  useEffect(() => {
    fetchOrg();
    fetchMembers();
    fetchStats();
    fetchActivities();
  }, [fetchOrg, fetchMembers, fetchStats, fetchActivities]);

  useEffect(() => {
    setIsLoading(false);
  }, [org]);

  const handleEditOrg = () => {
    if (!org) return;
    navigate(`/threatshield-admin/organizations/${org.id}/edit`);
  };

  const handleConfigureSSO = () => {
    if (!org) return;
    navigate(`/threatshield-admin/organizations/${org.id}/sso`);
  };

  const handleCreateAdmin = () => {
    if (!org) return;
    navigate(`/threatshield-admin/create-admin?org_id=${org.id}`);
  };

  const goBack = () => {
    navigate('/threatshield-admin/organizations');
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

  if (error || !org) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Card variant="outlined" className="border-red-200 dark:border-red-800">
            <CardContent className="pt-0 text-center py-8">
              <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load organization</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Organization not found'}</p>
              <Button variant="primary" onClick={goBack}>Back to Organizations</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'default' | 'danger'> = {
      active: 'success',
      inactive: 'default',
      suspended: 'danger',
    };
    return <Badge variant={variants[status] || 'default'} size="md" dot>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'scan_created':
      case 'url_scanned':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
      case 'user_invited':
        return (
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const getAuthMethodBadge = (method: string) => {
    const variants: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
      sso: 'info',
      password: 'success',
      email_auth: 'warning',
    };
    return <Badge variant={variants[method] || 'default'} size="sm">{method}</Badge>;
  };

  const getMemberStatusBadge = (user: User) => {
    if (user.is_provisioned === false) {
      return <Badge variant="danger" size="sm" dot>Deprovisioned</Badge>;
    }
    if (!user.is_active) {
      return <Badge variant="warning" size="sm" dot>Inactive</Badge>;
    }
    return <Badge variant="success" size="sm" dot>Active</Badge>;
  };

  const maxUsers = org.max_users ?? 5;
  const usersUsed = org.users_used ?? 0;
  const seatUsagePercentage = maxUsers > 0 ? Math.min(100, Math.round((usersUsed / maxUsers) * 100)) : 0;

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
                Back to Organizations
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleEditOrg}>Edit Organization</Button>
              <Button variant="outline" onClick={handleConfigureSSO}>Configure SSO</Button>
              <Button variant="primary" onClick={handleCreateAdmin}>Create Admin</Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
                {org.name?.[0]?.toUpperCase() || 'O'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {org.name}
                </h1>
                {getStatusBadge(org.status)}
              </div>
              <p className="mt-2 text-gray-600 dark:text-gray-400 font-mono text-sm">{org.slug}</p>
              {org.domain && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Domain: <span className="font-medium text-gray-900 dark:text-gray-100">{org.domain}</span></p>}
            </div>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Organization Info */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Organization Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Slug</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono">{org.slug}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Domain</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{org.domain || '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="mt-1">{getStatusBadge(org.status)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{org.created_at ? new Date(org.created_at).toLocaleDateString() : 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Plan Name</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 capitalize">{org.plan_name || 'Standard'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">License Status</dt>
                  <dd className="mt-1">
                    <Badge variant={org.plan_status === 'active' ? 'success' : org.plan_status === 'suspended' ? 'danger' : 'warning'} size="sm" dot>
                      {org.plan_status || 'active'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">License Expiry</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{org.license_expiry ? new Date(org.license_expiry).toLocaleDateString() : '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization ID</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-sm">{org.id}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* License & Usage */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">License & Usage</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Max Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{org.max_users}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Active Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{org.users_used}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Remaining Seats</p>
                <p className={`text-3xl font-bold ${org.users_remaining === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{org.users_remaining}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Monthly Scan Limit</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{org.scans_per_month || org.monthly_scan_limit}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Scans Used This Month</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.scans.total ?? org.scans_used}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Seat Utilization</p>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{usersUsed} of {maxUsers} Seats ({seatUsagePercentage}%)</p>
                <Progress value={usersUsed} max={maxUsers} variant={seatUsagePercentage >= 100 ? 'danger' : seatUsagePercentage >= 80 ? 'warning' : 'success'} size="md" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Authentication & Members Grid */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Authentication */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Authentication Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">SSO Configured</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Single Sign-On integration</p>
                </div>
                <Badge variant={org.sso_configured ? 'success' : 'default'} size="md" dot>
                  {org.sso_configured ? 'Configured' : 'Not Configured'}
                </Badge>
              </div>
              {org.auth_config && (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Email + Password</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Traditional authentication</p>
                    </div>
                    <Badge variant={org.auth_config.password_enabled ? 'success' : 'default'} size="md" dot>
                      {org.auth_config.password_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Email Authentication</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Magic link / passwordless login</p>
                    </div>
                    <Badge variant={org.auth_config.email_auth_enabled ? 'success' : 'default'} size="md" dot>
                      {org.auth_config.email_auth_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  {org.auth_config.sso_provider && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm">
                      <p className="text-gray-500 dark:text-gray-400">SSO Provider: <span className="text-gray-900 dark:text-gray-100 capitalize">{org.auth_config.sso_provider}</span></p>
                      {org.auth_config.sso_client_id && <p className="text-gray-500 dark:text-gray-400">Client ID: <span className="text-gray-900 dark:text-gray-100 font-mono">{org.auth_config.sso_client_id}</span></p>}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Members Summary */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Members Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Members</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.members.total ?? members.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Admins</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.members.admins ?? members.filter(m => m.role === 'admin' || m.role === 'owner').length}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">SSO Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{members.filter(m => m.user.auth_method === 'sso').length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organization Members */}
        <Card variant="outlined" className="border-gray-200 dark:border-gray-700 mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Organization Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {membersLoading ? (
              <div className="animate-pulse space-y-4 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No members yet</h3>
                <p className="text-gray-600 dark:text-gray-400">This organization has no members.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auth Method</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                {member.user.first_name?.[0] || member.user.email?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">{member.user.first_name} {member.user.last_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{member.user.email}</td>
                        <td className="px-4 py-4">
                          <Badge variant={member.role === 'owner' ? 'success' : member.role === 'admin' ? 'info' : 'default'} size="sm">
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">{getMemberStatusBadge(member.user)}</td>
                        <td className="px-4 py-4">{getAuthMethodBadge(member.user.auth_method || 'password')}</td>
                        <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(member.joined_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activitiesLoading ? (
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
                <p className="text-gray-600 dark:text-gray-400">This organization has not performed any tracked actions.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}