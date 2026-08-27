import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';
import { RiskScoreBypassSection } from '@components/settings/RiskScoreBypassSection';

export function SuperAdminSettingsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Settings
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage ThreatShield Super Admin configuration and platform settings.
              </p>
            </div>
            <Badge variant="danger" size="md" dot>Super Admin</Badge>
          </div>
        </header>

        {message && (
          <div className="mb-6 p-4 rounded-lg border" style={{
            backgroundColor: message.type === 'success' ? 'rgb(240 253 244)' : 'rgb(254 242 242)',
            borderColor: message.type === 'success' ? 'rgb(134 239 172)' : 'rgb(254 202 202)',
            color: message.type === 'success' ? 'rgb(22 163 74)' : 'rgb(220 38 38)'
          }} role="alert">
            {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Super Admin Profile</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {user?.email || 'ashwindm14@gmail.com'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Role</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <Badge variant="danger" size="md" dot>SUPER ADMIN</Badge>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  {user?.first_name || ''} {user?.last_name || ''}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">User ID</label>
                <div className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 font-mono text-sm text-gray-900 dark:text-gray-100">
                  {user?.id || '—'}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg">Platform Settings</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ThreatShield Platform</label>
                <div className="flex items-center gap-3">
                  <Badge variant="success" size="md" dot>Active</Badge>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Platform is operational</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Authentication Methods</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked disabled className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span className="text-gray-900 dark:text-gray-100">Email + Password</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={false} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span className="text-gray-900 dark:text-gray-100">SSO (SAML/OIDC)</span>
                    <Badge variant="default" size="sm">Not configured</Badge>
                  </label>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" disabled className="w-full">
                  Save Platform Settings
                </Button>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                  Platform settings require backend configuration
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Risk Score Bypass Configuration */}
          <div className="lg:col-span-2">
            <RiskScoreBypassSection isSuperAdmin={true} />
          </div>

          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Security</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Session Timeout</label>
                <div className="flex items-center gap-3">
                  <select disabled className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <option>30 minutes</option>
                    <option selected>1 hour</option>
                    <option>4 hours</option>
                    <option>8 hours</option>
                    <option>24 hours</option>
                  </select>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Default: 1 hour</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Failed Login Attempts</label>
                <div className="flex items-center gap-3">
                  <select disabled className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-32">
                    <option>3</option>
                    <option selected>5</option>
                    <option>10</option>
                    <option>Unlimited</option>
                  </select>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Default: 5</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password Requirements</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked disabled className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span className="text-gray-900 dark:text-gray-100">Minimum 8 characters</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked disabled className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span className="text-gray-900 dark:text-gray-100">Require uppercase</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked disabled className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span className="text-gray-900 dark:text-gray-100">Require number</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked disabled className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span className="text-gray-900 dark:text-gray-100">Require special character</span>
                  </label>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  Save Security Settings
                </Button>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Security settings are managed via backend configuration
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">System Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Environment</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Production</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">API Version</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">v1.0.0</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Frontend Version</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">v1.0.0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}