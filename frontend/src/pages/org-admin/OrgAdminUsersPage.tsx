import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { Progress } from '@components/ui/Progress';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminUsersPage() {
  const { user: currentAdmin } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [authMethodFilter, setAuthMethodFilter] = useState('');
  
  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Deactivate / Reactivate confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    user: any;
    action: 'deactivate' | 'reactivate';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create user state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    auth_method: 'password',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Invitation state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    first_name: '',
    last_name: '',
  });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response: any = await api.orgAdminListUsers({
        page: currentPage,
        per_page: 20,
        search,
        status: statusFilter,
        auth_method: authMethodFilter,
      });
      const userList = response.users || response.data || [];
      setUsers(userList);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, statusFilter, authMethodFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    setInvitationsLoading(true);
    try {
      const response: any = await api.orgAdminListInvitations({ per_page: 50 });
      setInvitations(response.invitations || response.data || []);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setInvitationsLoading(false);
    }
  }, []);

  // Fetch license info
  const fetchLicense = useCallback(async () => {
    setLicenseLoading(true);
    try {
      const response = await api.orgAdminGetLicense();
      setLicenseInfo(response.license);
    } catch (err) {
      console.error('Failed to load license:', err);
    } finally {
      setLicenseLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
    fetchLicense();
  }, [fetchInvitations, fetchLicense]);

  // Handle Deactivate / Reactivate confirmation
  const handleConfirmAction = async () => {
    if (!confirmModal?.user) return;
    const targetUser = confirmModal.user;
    const action = confirmModal.action;
    const userId = targetUser.id || targetUser._id || targetUser.user_id;

    if (!userId) {
      setToast({ message: 'User ID is missing', type: 'error' });
      setConfirmModal(null);
      return;
    }

    const isReactivate = action === 'reactivate';

    // 1. Optimistically update local users state for instant UI responsiveness
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        (u.id === userId || u.email === targetUser.email)
          ? {
              ...u,
              is_active: isReactivate,
              is_provisioned: isReactivate,
              deprovisioned_at: isReactivate ? null : new Date().toISOString(),
            }
          : u
      )
    );

    // 2. Close modal immediately
    setConfirmModal(null);
    setActionLoading(true);

    try {
      if (action === 'deactivate') {
        await api.orgAdminDeprovisionUser(userId);
        setToast({
          message: `User ${targetUser.first_name || ''} ${targetUser.last_name || ''} (${targetUser.email}) deactivated successfully.`,
          type: 'success',
        });
      } else {
        await api.orgAdminReactivateUser(userId);
        setToast({
          message: `User ${targetUser.first_name || ''} ${targetUser.last_name || ''} (${targetUser.email}) reactivated successfully.`,
          type: 'success',
        });
      }
      // Re-fetch users and license in background to sync with server
      await Promise.all([fetchUsers(), fetchLicense()]);
    } catch (err: any) {
      console.error('User action error:', err);
      const backendMessage = err.message || err.error || err.response?.data?.error || err.response?.data?.message || `Failed to ${action} user`;
      setToast({
        message: backendMessage,
        type: 'error',
      });
      // Revert optimistic update by refreshing from server
      fetchUsers();
      fetchLicense();
    } finally {
      setActionLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    if (!inviteData.email || !inviteData.first_name || !inviteData.last_name) {
      setInviteError('All fields are required');
      return;
    }

    setInviting(true);
    try {
      const response = await api.orgAdminInviteUser({
        email: inviteData.email.trim().toLowerCase(),
        first_name: inviteData.first_name.trim(),
        last_name: inviteData.last_name.trim(),
      });
      if (response && response.invite_url) {
        setCreatedInviteUrl(response.invite_url);
      }
      setInviteSuccess('Invitation created successfully!');
      setInviteData({ email: '', first_name: '', last_name: '' });
      setToast({ message: `Invitation sent to ${inviteData.email.trim()}`, type: 'success' });
      fetchInvitations();
      fetchLicense();
    } catch (err: any) {
      console.error('Invitation error:', err);
      const backendMessage = err.response?.data?.error || err.response?.data?.message;
      setInviteError(backendMessage || err.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvitation = async (inviteId: string) => {
    try {
      await api.orgAdminResendInvitation(inviteId);
      setToast({ message: 'Invitation resent successfully', type: 'success' });
      fetchInvitations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to resend invitation';
      setError(msg);
      setToast({ message: msg, type: 'error' });
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      await api.orgAdminCancelInvitation(inviteId);
      setToast({ message: 'Invitation cancelled successfully', type: 'info' });
      fetchInvitations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel invitation';
      setError(msg);
      setToast({ message: msg, type: 'error' });
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.first_name || !formData.last_name || !formData.email) {
      setFormError('All fields are required');
      return;
    }

    if (formData.auth_method === 'password' && !formData.password) {
      setFormError('Password is required for password authentication');
      return;
    }

    if (formData.password && formData.password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setCreating(true);
    try {
      await api.orgAdminCreateUser(formData);
      
      setShowCreateModal(false);
      setFormData({ first_name: '', last_name: '', email: '', auth_method: 'password', password: '' });
      setToast({ message: `User ${formData.email} created successfully`, type: 'success' });
      fetchUsers();
      fetchLicense();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || (err instanceof Error ? err.message : 'Failed to create user');
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (user: any) => {
    if (user.is_provisioned === false) {
      return <Badge variant="danger" size="sm" dot>Deprovisioned</Badge>;
    }
    if (!user.is_active) {
      return <Badge variant="warning" size="sm" dot>Inactive</Badge>;
    }
    return <Badge variant="success" size="sm" dot>Active</Badge>;
  };

  const getAuthMethodBadge = (method: string) => {
    const variants: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
      sso: 'info',
      password: 'success',
      email_auth: 'warning',
    };
    return <Badge variant={variants[method] || 'default'} size="sm">{method}</Badge>;
  };

  const isSeatLimitReached = licenseInfo ? licenseInfo.users_remaining === 0 : false;
  const seatUsagePercentage = licenseInfo && licenseInfo.max_users > 0
    ? Math.min(100, Math.round((licenseInfo.users_used / licenseInfo.max_users) * 100))
    : 0;

  const getProgressVariant = (pct: number): 'success' | 'warning' | 'danger' => {
    if (pct >= 100) return 'danger';
    if (pct >= 80) return 'warning';
    return 'success';
  };

  const usersTable = (
    <div>
      <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auth Method</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => {
                  const isCurrentUser = Boolean(currentAdmin && (user.id === currentAdmin.id || user.email === currentAdmin.email));
                  const isActive = Boolean(user.is_active && user.is_provisioned !== false);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {user.first_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {user.first_name} {user.last_name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-normal">
                                  You
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                      <td className="px-4 py-4">{getStatusBadge(user)}</td>
                      <td className="px-4 py-4">{getAuthMethodBadge(user.auth_method)}</td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/org-admin/users/${user.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>

                          {isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isCurrentUser}
                              title={isCurrentUser ? 'You cannot deactivate your own account' : 'Deactivate user account'}
                              className={isCurrentUser ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800'}
                              onClick={() => setConfirmModal({ isOpen: true, user, action: 'deactivate' })}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => setConfirmModal({ isOpen: true, user, action: 'reactivate' })}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-md animate-fade-in shadow-2xl">
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
              : toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100'
              : 'bg-blue-50 dark:bg-blue-950/90 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100'
          }`}>
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-sm font-medium">
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Users & License Management
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage organization members, provisioning status, and license seats
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setCreatedInviteUrl(null);
                  setInviteSuccess(null);
                  setInviteError(null);
                  setShowInviteModal(true);
                }}
                disabled={isSeatLimitReached}
                title={isSeatLimitReached ? 'License seat limit reached. Upgrade or deactivate users to invite more.' : 'Invite a new user'}
              >
                Invite User
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFormError(null);
                  setShowCreateModal(true);
                }}
                disabled={isSeatLimitReached}
                title={isSeatLimitReached ? 'License seat limit reached. Upgrade or deactivate users to create more.' : 'Create user directly'}
              >
                + Create User Directly
              </Button>
            </div>
          </div>

          {/* License Usage Card */}
          {licenseLoading ? (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 animate-pulse">
              <CardContent className="pt-6">
                <div className="h-8 w-1/4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              </CardContent>
            </Card>
          ) : licenseInfo && (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>License & Seat Usage</span>
                    <Badge variant={licenseInfo.plan_status === 'active' ? 'success' : 'warning'} size="sm" dot>
                      {licenseInfo.plan_status}
                    </Badge>
                  </CardTitle>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">
                    Plan: <strong className="text-gray-900 dark:text-gray-100">{licenseInfo.plan_name || 'Standard'}</strong>
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Active Seats</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {licenseInfo.users_used}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Currently active members</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Max Seats</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {licenseInfo.max_users}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Plan license limit</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Remaining Seats</p>
                    <p className={`text-2xl font-bold ${licenseInfo.users_remaining === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {licenseInfo.users_remaining}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Available to assign</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Monthly Scans</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {licenseInfo.scans_used} <span className="text-sm font-normal text-gray-500">/ {licenseInfo.scans_per_month}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scans consumed this month</p>
                  </div>
                </div>

                {/* Seat Progress Bar */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
                  <div className="flex justify-between items-center text-sm font-medium mb-2">
                    <span className="text-gray-700 dark:text-gray-300">Seat Utilization</span>
                    <span className="text-gray-900 dark:text-gray-100 font-bold">
                      {licenseInfo.users_used} of {licenseInfo.max_users} Seats Used ({seatUsagePercentage}%)
                    </span>
                  </div>
                  <Progress
                    value={licenseInfo.users_used}
                    max={licenseInfo.max_users}
                    variant={getProgressVariant(seatUsagePercentage)}
                    size="md"
                  />
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>{licenseInfo.users_remaining} available seat{licenseInfo.users_remaining === 1 ? '' : 's'} remaining</span>
                    {licenseInfo.license_expiry && (
                      <span>Renews/Expires: {new Date(licenseInfo.license_expiry).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Seat Limit Warning Banner */}
                {isSeatLimitReached && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-center gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <span className="font-semibold">License seat limit reached.</span> All {licenseInfo.max_users} seats are currently assigned to active users. Deactivate inactive accounts to free up seats, or contact your account manager to upgrade your license tier.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </header>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            placeholder="Search users by name or email..."
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
            <option value="provisioned">Provisioned</option>
            <option value="deprovisioned">Deprovisioned</option>
          </select>
          <select
            value={authMethodFilter}
            onChange={(e) => setAuthMethodFilter(e.target.value)}
            className="max-w-xs px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">All Auth Methods</option>
            <option value="password">Password</option>
            <option value="sso">SSO</option>
            <option value="email_auth">Email Auth</option>
          </select>
        </div>

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
        ) : users.length === 0 ? (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0 text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No users found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Create your first organization user</p>
              <Button variant="primary" onClick={() => setShowInviteModal(true)} disabled={isSeatLimitReached}>
                Invite User
              </Button>
            </CardContent>
          </Card>
        ) : (
          usersTable
        )}

        {/* Pending Invitations Section */}
        {invitations.length > 0 && (
          <div className="mt-10">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-lg">Pending Invitations ({invitations.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sent</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expires</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {invitations.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{inv.email}</td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {inv.first_name} {inv.last_name}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(inv.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(inv.expires_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant={inv.accepted_at ? 'success' : inv.is_expired ? 'danger' : 'warning'} size="sm" dot>
                              {inv.accepted_at ? 'Accepted' : inv.is_expired ? 'Expired' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!inv.accepted_at && !inv.is_expired && inv.token && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const url = `${window.location.origin}/invite/${inv.token}`;
                                    navigator.clipboard.writeText(url);
                                    setToast({ message: 'Copied invitation link to clipboard', type: 'info' });
                                  }}
                                >
                                  Copy Link
                                </Button>
                              )}
                              {!inv.accepted_at && !inv.is_expired && (
                                <Button variant="outline" size="sm" onClick={() => handleResendInvitation(inv.id)}>
                                  Resend
                                </Button>
                              )}
                              {!inv.accepted_at && !inv.is_expired && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => handleCancelInvitation(inv.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Confirmation Modal for Deactivate / Reactivate */}
        {confirmModal && confirmModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => !actionLoading && setConfirmModal(null)}
          >
            <div
              className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full flex-shrink-0 ${
                  confirmModal.action === 'deactivate'
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                }`}>
                  {confirmModal.action === 'deactivate' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {confirmModal.action === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {confirmModal.action === 'deactivate' ? (
                      <>
                        Are you sure you want to deactivate <strong className="text-gray-900 dark:text-gray-100">{confirmModal.user.first_name} {confirmModal.user.last_name}</strong> (<span className="font-mono text-xs">{confirmModal.user.email}</span>)?
                      </>
                    ) : (
                      <>
                        Are you sure you want to reactivate <strong className="text-gray-900 dark:text-gray-100">{confirmModal.user.first_name} {confirmModal.user.last_name}</strong> (<span className="font-mono text-xs">{confirmModal.user.email}</span>)?
                      </>
                    )}
                  </p>

                  <div className={`mt-4 p-3 rounded-lg text-xs ${
                    confirmModal.action === 'deactivate'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                      : 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
                  }`}>
                    {confirmModal.action === 'deactivate' ? (
                      <span>
                        • The user will immediately lose access to ThreatShield.<br />
                        • Their active seat will be released back to the organization ({licenseInfo?.users_remaining ?? 0} &rarr; {(licenseInfo?.users_remaining ?? 0) + 1} remaining).<br />
                        • All history and scan logs remain preserved.
                      </span>
                    ) : (
                      <span>
                        • The user will regain immediate access to ThreatShield.<br />
                        • This will consume 1 license seat ({licenseInfo?.users_remaining ?? 0} currently available).
                      </span>
                    )}
                  </div>

                  {confirmModal.action === 'reactivate' && isSeatLimitReached && (
                    <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
                      Cannot Reactivate: No seats remaining ({licenseInfo?.users_used}/{licenseInfo?.max_users}). Please deactivate another user first.
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={actionLoading}
                      onClick={() => setConfirmModal(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant={confirmModal.action === 'deactivate' ? 'danger' : 'primary'}
                      loading={actionLoading}
                      disabled={actionLoading || (confirmModal.action === 'reactivate' && isSeatLimitReached)}
                      className={confirmModal.action === 'reactivate' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                      onClick={handleConfirmAction}
                    >
                      {confirmModal.action === 'deactivate' ? 'Deactivate User' : 'Reactivate User'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create User Directly Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreateModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
              <Card variant="outlined" className="border-transparent shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Create User Directly</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    {formError && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        {formError}
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="First Name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        placeholder="John"
                        required
                      />
                      <Input
                        label="Last Name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        placeholder="Doe"
                        required
                      />
                    </div>
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="user@example.com"
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Authentication Method
                      </label>
                      <select
                        value={formData.auth_method}
                        onChange={(e) => setFormData({...formData, auth_method: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="password">Email + Password</option>
                        <option value="sso">SSO</option>
                        <option value="email_auth">Email Authentication</option>
                      </select>
                    </div>
                    {formData.auth_method === 'password' && (
                      <Input
                        label="Password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="••••••••"
                        required
                        helperText="At least 8 characters"
                      />
                    )}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                      <Button type="submit" variant="primary" loading={creating} className="flex-1">
                        Create User
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Invite User Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInviteModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
              <Card variant="outlined" className="border-transparent shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Invite User</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <form onSubmit={handleInviteUser} className="space-y-4">
                    {inviteError && (
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        {inviteError}
                      </div>
                    )}
                    {inviteSuccess && (
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
                        {inviteSuccess}
                      </div>
                    )}
                    {createdInviteUrl && (
                      <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Invitation Link:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={createdInviteUrl}
                            className="text-xs w-full bg-white dark:bg-gray-800 p-1.5 rounded border border-gray-300 dark:border-gray-600 select-all"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(createdInviteUrl);
                              setToast({ message: 'Copied link to clipboard', type: 'info' });
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="First Name"
                        value={inviteData.first_name}
                        onChange={(e) => setInviteData({...inviteData, first_name: e.target.value})}
                        placeholder="John"
                        required
                      />
                      <Input
                        label="Last Name"
                        value={inviteData.last_name}
                        onChange={(e) => setInviteData({...inviteData, last_name: e.target.value})}
                        placeholder="Doe"
                        required
                      />
                    </div>
                    <Input
                      label="Email"
                      type="email"
                      value={inviteData.email}
                      onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                      placeholder="user@example.com"
                      required
                    />
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                      <Button type="submit" variant="primary" loading={inviting} className="flex-1">
                        Send Invitation
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowInviteModal(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}