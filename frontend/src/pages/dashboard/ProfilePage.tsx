import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';
import { classNames } from '@utils/helpers';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security' | 'extensions'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Extension
  const [extensionLinked, setExtensionLinked] = useState(user?.extension_linked || false);
  const [extensionToken, setExtensionToken] = useState<string | null>(null);
  const [extensionLinkedAt, setExtensionLinkedAt] = useState<string | null>(user?.extension_linked_at || null);

  const handleProfileSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await api.updateProfile({ first_name: firstName, last_name: lastName });
      await refreshUser();
      setSuccess('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  }, [firstName, lastName, refreshUser]);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword]);

  const handleLinkExtension = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await api.linkExtension();
      setExtensionToken(response.extension_token);
      setExtensionLinked(true);
      setExtensionLinkedAt(new Date().toISOString());
      await refreshUser();
      setSuccess('Extension linked successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link extension');
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const handleUnlinkExtension = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await api.unlinkExtension();
      setExtensionToken(null);
      setExtensionLinked(false);
      setExtensionLinkedAt(null);
      await refreshUser();
      setSuccess('Extension unlinked successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink extension');
    } finally {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const checkExtensionStatus = useCallback(async () => {
    try {
      const response = await api.getExtensionStatus();
      setExtensionLinked(response.linked);
      setExtensionLinkedAt(response.linked_at);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    checkExtensionStatus();
  }, [checkExtensionStatus]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Profile & Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account, security, and browser extension
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300" role="alert">
            {success}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8" aria-label="Profile sections">
            {[
              { id: 'profile', label: 'Profile', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )},
              { id: 'password', label: 'Password', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )},
              { id: 'security', label: 'Security', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )},
              { id: 'extensions', label: 'Browser Extension', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              )},
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={classNames(
                  'flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800" aria-hidden="true">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                  <Input
                    label="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                  helperText="Email cannot be changed. Contact support if you need to update it."
                />
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button type="submit" variant="primary" loading={isLoading}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  helperText="At least 8 characters"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button type="submit" variant="primary" loading={isLoading}>
                    Change Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Security Settings</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Account Status</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={user?.is_active ? 'success' : 'danger'} size="md" dot>
                    {user?.is_active ? 'Active' : 'Deactivated'}
                  </Badge>
                  <Badge variant={user?.is_verified ? 'success' : 'warning'} size="md" dot>
                    {user?.is_verified ? 'Verified' : 'Unverified'}
                  </Badge>
                  <Badge variant="info" size="md" dot>
                    {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'org_admin' ? 'Org Admin' : 'User'}
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Login History</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last login: {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Account created: {user?.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Session Management</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Your session will expire after 1 hour of inactivity. You'll need to log in again.
                </p>
                <Button variant="outline" onClick={() => refreshUser()}>
                  Refresh Session
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Extensions Tab */}
        {activeTab === 'extensions' && (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="text-lg">Browser Extension</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center" aria-hidden="true">
                    <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">ThreatShield Extension</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Real-time URL protection in your browser</p>
                  </div>
                </div>
                <Badge variant={extensionLinked ? 'success' : 'default'} size="md" dot>
                  {extensionLinked ? 'Linked' : 'Not Linked'}
                </Badge>
              </div>

              {!extensionLinked ? (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Link the ThreatShield browser extension to your account to enable real-time URL scanning and protection while you browse.
                  </p>
                  <Button variant="primary" onClick={handleLinkExtension} loading={isLoading}>
                    Link Extension
                  </Button>
                </div>
              ) : (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Extension Token</h4>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">
                        {extensionToken || 'Loading...'}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(extensionToken || '')}>
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Keep this token secure. It provides access to your ThreatShield account from the browser extension.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Linked At</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {extensionLinkedAt ? new Date(extensionLinkedAt).toLocaleString() : 'Unknown'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Button variant="danger" onClick={handleUnlinkExtension} loading={isLoading}>
                      Unlink Extension
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This will disable real-time protection in the browser extension.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}