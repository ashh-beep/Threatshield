import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [authMethodFilter, setAuthMethodFilter] = useState('');
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
  const [copied, setCopied] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.orgAdminListUsers({
        page: currentPage,
        per_page: 20,
        search,
        status: statusFilter,
        auth_method: authMethodFilter,
      });
      setUsers(response.data || []);
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
      const response = await api.orgAdminListInvitations({ per_page: 50 });
      setInvitations(response.data || []);
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
      fetchInvitations();
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
      fetchInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      await api.orgAdminCancelInvitation(inviteId);
      fetchInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
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
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleProvision = async (userId: string) => {
    try {
      await api.orgAdminProvisionUser(userId);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision user');
    }
  };

  const handleDeprovision = async (userId: string) => {
    if (!confirm('Are you sure you want to deprovision this user? They will lose access to ThreatShield.')) return;
    try {
      await api.orgAdminDeprovisionUser(userId);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deprovision user');
    }
  };

  const getStatusBadge = (user: any) => {
    if (!user.is_provisioned) return <Badge variant="danger" size="sm" dot>Deprovisioned</Badge>;
    if (!user.is_active) return <Badge variant="warning" size="sm" dot>Inactive</Badge>;
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

  const usersTable = (
    <div>
      <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auth Method</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
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
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                    <td className="px-4 py-4">{getAuthMethodBadge(user.auth_method)}</td>
                    <td className="px-4 py-4">{getStatusBadge(user)}</td>
                    <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/org-admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        {user.is_provisioned ? (
                          <Button variant="outline" size="sm" onClick={() => handleDeprovision(user.id)}>Deprovision</Button>
                        ) : (
                          <Button variant="primary" size="sm" onClick={() => handleProvision(user.id)}>Provision</Button>
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
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Users
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage organization users
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => { setCreatedInviteUrl(null); setInviteSuccess(null); setInviteError(null); setShowInviteModal(true); }} disabled={licenseInfo?.users_remaining === 0}>
                Invite User
              </Button>
              <Button variant="outline" onClick={() => { setFormError(null); setShowCreateModal(true); }} disabled={licenseInfo?.users_remaining === 0}>
                + Create User Directly
              </Button>
            </div>
          </div>

          {/* License Usage Card */}
          {licenseLoading ? (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 animate-pulse">
              <CardContent className="pt-0">
                <div className="h-8 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
              </CardContent>
            </Card>
          ) : licenseInfo && (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 mb-6">
              <CardHeader>
                <CardTitle className="text-lg">License Usage</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Plan</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{licenseInfo.plan_name || 'Not set'}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Seats</p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{licenseInfo.users_used} / {licenseInfo.max_users}</span>
                      <Badge variant={licenseInfo.plan_status === 'active' ? 'success' : 'warning'} size="sm" dot>
                        {licenseInfo.plan_status}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monthly Scans</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">{licenseInfo.scans_used} / {licenseInfo.scans_per_month}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Expiry</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {licenseInfo.license_expiry ? new Date(licenseInfo.license_expiry).toLocaleDateString() : 'Not set'}
                      {licenseInfo.is_expired && <Badge variant="danger" size="sm" className="ml-2">Expired</Badge>}
                    </p>
                  </div>
                </div>
                {licenseInfo.users_remaining === 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <span className="font-medium">Seat limit reached.</span> You cannot invite more users until seats are available or the license is upgraded.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </header>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search users..."
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
                <Button variant="primary" onClick={() => setShowInviteModal(true)} disabled={licenseInfo?.users_remaining === 0}>Invite User</Button>
              </CardContent>
            </Card>
) : (
            usersTable
          )}

          {invitations.length > 0 && (
            <div>
              <div className="mt-8" />
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
                                      alert(`Copied invitation link:\n${url}`);
                                    }}
                                  >
                                    Copy Link
                                  </Button>
                                )}
                                {!inv.accepted_at && !inv.is_expired && (
                                  <Button variant="outline" size="sm" onClick={() => handleResendInvitation(inv.id)}>Resend</Button>
                                )}
                                {!inv.accepted_at && !inv.is_expired && (
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleCancelInvitation(inv.id)}>Cancel</Button>
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

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCreateModal(false)}>
            <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
              <Card variant="outlined" className="border-transparent shadow-none">
                <CardHeader>
                <CardTitle className="text-lg">Create User</CardTitle>
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