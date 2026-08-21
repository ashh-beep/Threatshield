import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Badge } from '@components/ui/Badge';
import { useAuth } from '@context/AuthContext';
import { api, type SSOConfig } from '@services/api';
import { classNames } from '@utils/helpers';

export function OrgAdminSSOPage() {
  const { primaryOrgId } = useAuth();
  const [ssoConfig, setSsoConfig] = useState<SSOConfig | null>(null);
  const [configured, setConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: '',
    tenant_id: 'common',
    enabled: true,
  });

  const fetchSSOConfig = useCallback(async () => {
    if (!primaryOrgId) return;
    setIsLoading(true);
    try {
      const response = await api.getSSOConfig(primaryOrgId);
      setConfigured(response.configured);
      if (response.configured && response.sso_config) {
        setSsoConfig(response.sso_config);
        setFormData({
          client_id: response.sso_config.client_id || '',
          client_secret: '',
          tenant_id: response.sso_config.tenant_id || 'common',
          enabled: response.sso_config.enabled ?? true,
        });
      }
    } catch (err) {
      setError('Failed to load SSO configuration');
    } finally {
      setIsLoading(false);
    }
  }, [primaryOrgId]);

  useEffect(() => {
    fetchSSOConfig();
  }, [fetchSSOConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryOrgId) return;
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      if (configured) {
        await api.configureSSO(primaryOrgId, formData);
      } else {
        await api.configureSSO(primaryOrgId, formData);
      }
      setSuccess('SSO configuration saved successfully');
      fetchSSOConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SSO configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!primaryOrgId || !confirm('Are you sure you want to disable SSO? This will remove the configuration.')) return;
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      await api.disableSSO(primaryOrgId);
      setSuccess('SSO disabled successfully');
      setConfigured(false);
      setSsoConfig(null);
      setFormData({ client_id: '', client_secret: '', tenant_id: 'common', enabled: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable SSO');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            SSO Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure Microsoft Entra ID Single Sign-On for your organization
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

        <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Microsoft Entra ID SSO</CardTitle>
                <CardDescription>
                  Enable Single Sign-On with Microsoft Entra ID (Azure AD) for your organization members.
                </CardDescription>
              </div>
              <Badge variant={configured ? 'success' : 'default'} size="md" dot>
                {configured ? 'Configured' : 'Not Configured'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Client ID"
                  type="text"
                  value={formData.client_id}
                  onChange={(e) => handleInputChange('client_id', e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                  disabled={isSaving}
                />
                <Input
                  label="Tenant ID"
                  type="text"
                  value={formData.tenant_id}
                  onChange={(e) => handleInputChange('tenant_id', e.target.value)}
                  placeholder="common"
                  defaultValue="common"
                  required
                  disabled={isSaving}
                />
              </div>

              <Input
                label="Client Secret"
                type="password"
                value={formData.client_secret}
                onChange={(e) => handleInputChange('client_secret', e.target.value)}
                placeholder={configured ? 'Leave blank to keep current secret' : 'Enter client secret'}
                required={!configured}
                disabled={isSaving}
                helperText={configured ? 'Leave blank to keep the current client secret' : 'Enter the client secret from Azure AD app registration'}
              />

              <Input
                label="Redirect URI (for reference)"
                type="text"
                value={`${window.location.origin}/auth/sso/callback`}
                disabled
                helperText="This is the redirect URI configured in your Azure AD app registration"
              />

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => handleInputChange('enabled', e.target.checked.toString())}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={isSaving}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable SSO</span>
                </label>
              </div>

              {configured && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Current Configuration</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Client ID: {ssoConfig?.client_id}</p>
                    </div>
                    <Button
                      variant="danger"
                      type="button"
                      onClick={handleDisable}
                      loading={isSaving}
                    >
                      Disable SSO
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <Button type="submit" variant="primary" loading={isSaving} className="flex-1">
                  {configured ? 'Update Configuration' : 'Save Configuration'}
                </Button>
                {configured && (
                  <Button type="button" variant="ghost" onClick={fetchSSOConfig} loading={isLoading}>
                    Reset Form
                  </Button>
                )}
              </div>
            </form>

            {/* Setup Instructions */}
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Setup Instructions</h3>
              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">1. Register an Application in Azure Portal</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Azure Portal</a> → Microsoft Entra ID → App registrations</li>
                    <li>Click "New registration" and enter a name (e.g., "Gatekeeper SSO")</li>
                    <li>Select "Accounts in any organizational directory" for multi-tenant</li>
                    <li>Set Redirect URI to <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">{window.location.origin}/auth/sso/callback</code></li>
                  </ol>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">2. Configure API Permissions</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>In your app registration, go to "API permissions" → "Add a permission"</li>
                    <li>Select "Microsoft Graph" → "Delegated permissions"</li>
                    <li>Add: <code>openid</code>, <code>profile</code>, <code>email</code>, <code>User.Read</code></li>
                    <li>Click "Grant admin consent" for your organization</li>
                  </ol>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">3. Create Client Secret</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to "Certificates & secrets" → "New client secret"</li>
                    <li>Add description and set expiration</li>
                    <li><strong>Copy the secret value immediately</strong> - it won't be shown again</li>
                  </ol>
                </div>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">4. Enter Configuration Here</h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Client ID: From "Overview" page (Application ID)</li>
                    <li>Client Secret: The value you just copied</li>
                    <li>Tenant ID: From "Overview" page (Directory ID) - use "common" for multi-tenant</li>
                    <li>Enable SSO and save</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}