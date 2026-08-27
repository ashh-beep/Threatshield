import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@components/ui/Tabs';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminProvisioningPage() {
  const [provisionedUsers, setProvisionedUsers] = useState<any[]>([]);
  const [deprovisionedUsers, setDeprovisionedUsers] = useState<any[]>([]);
  const [provisionedTotal, setProvisionedTotal] = useState(0);
  const [deprovisionedTotal, setDeprovisionedTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [totalsLoading, setTotalsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string>('provisioned');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response: any = await api.orgAdminProvisioning({
        page: currentPage,
        per_page: 50,
        status: activeTab,
      });
      const userList = response.users || response.data || [];
      if (activeTab === 'provisioned') {
        setProvisionedUsers(userList);
        setProvisionedTotal(response.pagination?.total || 0);
      } else {
        setDeprovisionedUsers(userList);
        setDeprovisionedTotal(response.pagination?.total || 0);
      }
      setTotalPages(response.pagination?.pages || 1);
      setSelectedUsers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, activeTab]);

  // Fetch totals for both tabs on mount
  const fetchTotals = useCallback(async () => {
    setTotalsLoading(true);
    try {
      const [provisionedRes, deprovisionedRes] = await Promise.all([
        api.orgAdminProvisioning({ page: 1, per_page: 1, status: 'provisioned' }),
        api.orgAdminProvisioning({ page: 1, per_page: 1, status: 'deprovisioned' }),
      ]);
      setProvisionedTotal(provisionedRes.pagination?.total || 0);
      setDeprovisionedTotal(deprovisionedRes.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch totals:', err);
    } finally {
      setTotalsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTotals();
  }, [fetchTotals]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSelectAll = () => {
    const users = activeTab === 'provisioned' ? provisionedUsers : deprovisionedUsers;
    setSelectedUsers(users.map(u => u.id));
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUsers(prev => prev.includes(userId) 
      ? prev.filter(id => id !== userId)
      : [...prev, userId]
    );
  };

  const handleBulkAction = async (action: 'provision' | 'deprovision') => {
    if (selectedUsers.length === 0) return;
    
    const confirmMsg = action === 'deprovision' 
      ? `Are you sure you want to deprovision ${selectedUsers.length} users? They will lose access to ThreatShield.`
      : `Provision ${selectedUsers.length} users?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      await api.orgAdminBulkProvisioning(selectedUsers, action);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} users`);
    }
  };

  const handleSingleAction = async (userId: string, action: 'provision' | 'deprovision') => {
    const confirmMsg = action === 'deprovision' 
      ? 'Are you sure you want to deprovision this user? They will lose access to ThreatShield.'
      : 'Provision this user?';
    
    if (!confirm(confirmMsg)) return;

    try {
      if (action === 'provision') {
        await api.orgAdminProvisionUser(userId);
      } else {
        await api.orgAdminDeprovisionUser(userId);
      }
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} user`);
    }
  };

  const users = activeTab === 'provisioned' ? provisionedUsers : deprovisionedUsers;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Provisioning
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage user provisioning status
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="provisioned">Provisioned Users ({provisionedTotal})</TabsTrigger>
            <TabsTrigger value="deprovisioned">Deprovisioned Users ({deprovisionedTotal})</TabsTrigger>
          </TabsList>

          <TabsContent value="provisioned" className="mt-6">
            {selectedUsers.length > 0 && (
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center justify-between">
                <span className="text-sm text-yellow-800 dark:text-yellow-200">
                  {selectedUsers.length} user(s) selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedUsers([])}>
                    Clear Selection
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkAction('deprovision')}>
                    Deprovision Selected
                  </Button>
                </div>
              </div>
            )}

            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Provisioned Users</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkAction('deprovision')} disabled={selectedUsers.length === 0}>
                      Bulk Deprovision
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading && activeTab === 'provisioned' ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4 p-4">
                        <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600" />
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1">
                          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="mt-1 h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeTab === 'provisioned' && provisionedTotal === 0 && !totalsLoading ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No provisioned users</h3>
                    <p className="text-gray-600 dark:text-gray-400">All users in this organization are deprovisioned</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="w-12 px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedUsers.length === users.length && users.length > 0}
                                onChange={handleSelectAll}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auth Method</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Login</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.includes(user.id)}
                                  onChange={() => handleToggleUser(user.id)}
                                  className="w-4 h-4 rounded border-gray-300"
                                />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                      {user.first_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{user.first_name} {user.last_name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                              <td className="px-4 py-4">
                                <Badge variant={user.auth_method === 'sso' ? 'info' : user.auth_method === 'password' ? 'success' : 'warning'} size="sm">
                                  {user.auth_method}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <Button variant="outline" size="sm" onClick={() => handleSingleAction(user.id, 'deprovision')}>
                                  Deprovision
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages}</span>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deprovisioned" className="mt-6">
            {selectedUsers.length > 0 && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                <span className="text-sm text-green-800 dark:text-green-200">
                  {selectedUsers.length} user(s) selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedUsers([])}>Clear Selection</Button>
                  <Button variant="primary" size="sm" onClick={() => handleBulkAction('provision')}>Provision Selected</Button>
                </div>
              </div>
            )}

            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Deprovisioned Users</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>Select All</Button>
                    <Button variant="primary" size="sm" onClick={() => handleBulkAction('provision')} disabled={selectedUsers.length === 0}>Bulk Provision</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading && activeTab === 'deprovisioned' ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4 p-4">
                        <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600" />
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1">
                          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="mt-1 h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeTab === 'deprovisioned' && deprovisionedTotal === 0 && !totalsLoading ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No deprovisioned users</h3>
                    <p className="text-gray-600 dark:text-gray-400">All users in this organization are provisioned</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="w-12 px-4 py-3 text-center">
                              <input type="checkbox" checked={selectedUsers.length === users.length && users.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-gray-300" />
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Auth Method</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deprovisioned</th>
                            <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-4 text-center">
                                <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleToggleUser(user.id)} className="w-4 h-4 rounded border-gray-300" />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                      {user.first_name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{user.first_name} {user.last_name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                              <td className="px-4 py-4">
                                <Badge variant={user.auth_method === 'sso' ? 'info' : user.auth_method === 'password' ? 'success' : 'warning'} size="sm">
                                  {user.auth_method}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {user.deprovisioned_at ? new Date(user.deprovisioned_at).toLocaleString() : 'Unknown'}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <Button variant="primary" size="sm" onClick={() => handleSingleAction(user.id, 'provision')}>Provision</Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-6">
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages}</span>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}