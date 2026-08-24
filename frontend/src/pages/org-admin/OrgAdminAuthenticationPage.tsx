import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Input } from '@components/ui/Input';
import { useAuth } from '@context/AuthContext';
import { api } from '@services/api';

export function OrgAdminAuthenticationPage() {
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [newSecret, setNewSecret] = useState('');

  // Pre-filled Microsoft Entra ID credentials
  const DEFAULT_TENANT_ID = '9e538254-9fc8-4c58-8017-eda881f4d21f';
  const DEFAULT_CLIENT_ID = 'e72b3e1b-baa8-4164-99b1-f1b5e7c01eeb';

  const fetchConfig = async () => {
    try {
      const response = await api.orgAdminGetAuthConfig();
      const authConfig = response.auth_config;
      
      // Pre-fill Microsoft credentials if not already configured
      if (authConfig.sso_provider === 'microsoft' || !authConfig.sso_provider) {
        if (!authConfig.sso_tenant_id) {
          authConfig.sso_tenant_id = DEFAULT_TENANT_ID;
        }
        if (!authConfig.sso_client_id) {
          authConfig.sso_client_id = DEFAULT_CLIENT_ID;
        }
      }
      
      setConfig(authConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load authentication config');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!config.password_enabled && !config.sso_enabled && !config.email_auth_enabled) {
      setError('At least one authentication method must be enabled');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        password_enabled: config.password_enabled,
        sso_enabled: config.sso_enabled,
        email_auth_enabled: config.email_auth_enabled,
        sso_provider: config.sso_provider,
        sso_client_id: config.sso_client_id,
        sso_client_secret: newSecret || undefined,
        sso_tenant_id: config.sso_tenant_id,
        sso_issuer: config.sso_issuer,
        sso_redirect_url: config.sso_redirect_url,
        sso_domain: config.sso_domain,
        sso_metadata_url: config.sso_metadata_url,
        email_auth_domain: config.email_auth_domain,
      };
      const response = await api.orgAdminUpdateAuthConfig(payload);
      setConfig(response.auth_config);
      setNewSecret('');
      setShowSecret(false);
      setSuccess('Authentication configuration saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardContent className="pt-0">
              <div className="h-8 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Authentication Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure how users in your organization authenticate with ThreatShield
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

        <Card variant="outlined" className="border-gray-200 dark:border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Authentication Methods</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.password_enabled}
                  onChange={(e) => setConfig({...config, password_enabled: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Email + Password</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Users authenticate with email and password</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.sso_enabled}
                  onChange={(e) => setConfig({...config, sso_enabled: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">SSO (Single Sign-On)</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Users authenticate via SAML/OIDC identity provider</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.email_auth_enabled}
                  onChange={(e) => setConfig({...config, email_auth_enabled: e.target.checked})}
                  className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Email Authentication</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Users authenticate via email magic link</p>
                </div>
              </label>
            </div>
            {!config?.password_enabled && !config?.sso_enabled && !config?.email_auth_enabled && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Warning: At least one authentication method must be enabled
              </p>
            )}
          </CardContent>
        </Card>

        {config?.sso_enabled && (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-lg">SSO Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">SSO Status</span>
                  <Badge variant={config?.configured ? 'success' : 'warning'} size="md" dot>
                    {config?.configured ? 'Configured' : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {config?.configured ? 'SSO is configured and active' : 'SSO is enabled but not fully configured'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Provider"
                  value={config?.sso_provider || ''}
                  onChange={(e) => setConfig({...config, sso_provider: e.target.value})}
                  placeholder="microsoft, google, okta, custom"
                />
                <Input
                  label="Client ID"
                  value={config?.sso_client_id || ''}
                  onChange={(e) => setConfig({...config, sso_client_id: e.target.value})}
                  placeholder="your-client-id"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Client Secret
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={showSecret ? (config?.sso_client_secret || '') : newSecret}
                    onChange={(e) => {
                      if (showSecret) {
                        setConfig({...config, sso_client_secret: e.target.value});
                      } else {
                        setNewSecret(e.target.value);
                      }
                    }}
                    placeholder={config?.configured ? '••••••••' : 'Enter new secret to update'}
                    disabled={showSecret && config?.configured && !newSecret}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? 'Hide' : config?.configured ? 'Update' : 'Set'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {config?.configured 
                    ? 'Enter a new secret to update, or leave empty to keep current'
                    : 'Enter the client secret from your identity provider'}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Tenant ID"
                  value={config?.sso_tenant_id || ''}
                  onChange={(e) => setConfig({...config, sso_tenant_id: e.target.value})}
                  placeholder="common (Microsoft) or your-tenant-id"
                />
                <Input
                  label="Issuer"
                  value={config?.sso_issuer || ''}
                  onChange={(e) => setConfig({...config, sso_issuer: e.target.value})}
                  placeholder="https://login.microsoftonline.com/.../v2.0"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Redirect URL"
                  value={config?.sso_redirect_url || ''}
                  onChange={(e) => setConfig({...config, sso_redirect_url: e.target.value})}
                  placeholder="https://yourdomain.com/auth/callback"
                />
                <Input
                  label="Domain"
                  value={config?.sso_domain || ''}
                  onChange={(e) => setConfig({...config, sso_domain: e.target.value})}
                  placeholder="yourdomain.com"
                />
              </div>

              <Input
                label="Metadata URL"
                value={config?.sso_metadata_url || ''}
                onChange={(e) => setConfig({...config, sso_metadata_url: e.target.value})}
                placeholder="https://login.microsoftonline.com/.../.well-known/openid-configuration"
              />

              <p className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
                Note: Client secret is stored encrypted and never returned in API responses.
              </p>
            </CardContent>
          </Card>
        )}

        {config?.email_auth_enabled && (
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700 mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Email Authentication Configuration</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <Input
                label="Email Auth Domain (optional)"
                value={config?.email_auth_domain || ''}
                onChange={(e) => setConfig({...config, email_auth_domain: e.target.value})}
                placeholder="yourdomain.com"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Restrict email authentication to specific domains
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save Configuration
          </Button>
          <Button variant="ghost" onClick={fetchConfig}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}