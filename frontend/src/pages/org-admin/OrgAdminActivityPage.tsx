import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

interface ActivityMetadata {
  url?: string;
  verdict?: string;
  risk_score?: number;
  scan_id?: string;
  [key: string]: unknown;
}

interface ActivityLog {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  type: string;
  description: string;
  metadata: ActivityMetadata;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

const getVerdictBadgeVariant = (verdict?: string): 'success' | 'warning' | 'danger' | 'default' => {
  switch (verdict?.toLowerCase()) {
    case 'safe':
      return 'success';
    case 'suspicious':
      return 'warning';
    case 'dangerous':
      return 'danger';
    default:
      return 'default';
  }
};

const getRiskScoreColor = (score?: number): string => {
  if (score === undefined) return 'text-gray-500';
  if (score >= 70) return 'text-red-600 dark:text-red-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
};

export function OrgAdminActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // Fetch activities once on mount
  useEffect(() => {
    let cancelled = false;
    const loadActivities = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.orgAdminActivity({
          page: 1,
          per_page: 200,
        });
        if (!cancelled) {
          const activitiesData = (response as { activity?: ActivityLog[] }).activity || [];
          setActivities(activitiesData);
          setTotalPages(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load activity');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    loadActivities();
    return () => {
      cancelled = true;
    };
  }, []);

  // Client-side filtered activities
  const filteredActivities = useMemo(() => {
    if (!search) return activities;
    const searchLower = search.toLowerCase();
    return activities.filter((a) =>
      a.description.toLowerCase().includes(searchLower) ||
      a.type.toLowerCase().includes(searchLower) ||
      a.user?.email.toLowerCase().includes(searchLower) ||
      a.user?.first_name.toLowerCase().includes(searchLower) ||
      a.user?.last_name.toLowerCase().includes(searchLower)
    );
  }, [activities, search]);

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
      scan_created: 'info',
      scan_viewed: 'default',
      user_invited: 'info',
      user_invite_accepted: 'success',
      user_invite_cancelled: 'warning',
      user_invite_resent: 'info',
      user_reactivated: 'success',
      url_scanned: 'info',
    };
    return variants[type] || 'default';
  };

  const formatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const renderActionIcon = (type: string) => {
    switch (type) {
      case 'user_invited':
        return (
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      case 'user_invite_accepted':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'user_sso_login':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'scan_created':
      case 'url_scanned':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'user_deprovisioned':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'user_reactivated':
        return (
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'user_login':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        );
      case 'user_logout':
        return (
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        );
      case 'user_created':
      case 'user_provisioned':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
    }
  };

  const renderDescription = (activity: ActivityLog) => {
    if (activity.type === 'scan_created' && activity.metadata) {
      const { url, verdict, risk_score } = activity.metadata;
      return (
        <div className="space-y-1">
          {url && (
            <p className="font-mono text-sm text-blue-600 dark:text-blue-400 truncate max-w-xs" title={url}>
              {url}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {verdict && (
              <Badge variant={getVerdictBadgeVariant(verdict)} size="sm">
                {verdict.charAt(0).toUpperCase() + verdict.slice(1)}
              </Badge>
            )}
            {risk_score !== undefined && (
              <Badge variant="default" size="sm" className={getRiskScoreColor(risk_score)}>
                Risk: {risk_score}
              </Badge>
            )}
          </div>
        </div>
      );
    }
    return <span>{activity.description}</span>;
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
              <Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        ) : filteredActivities.length === 0 ? (
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
                <CardTitle className="text-lg">Recent Activity ({filteredActivities.length})</CardTitle>
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
                      {filteredActivities.map((activity) => (
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
                              {renderActionIcon(activity.type)}
                              <Badge variant={getActionBadge(activity.type)} size="sm">
                                {formatType(activity.type)}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                            {renderDescription(activity)}
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
          </>
        )}
      </div>
    </div>
  );
}