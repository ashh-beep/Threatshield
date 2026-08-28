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

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserScan {
  id: string;
  url: string;
  verdict: string;
  risk_score: number;
  risk_color: string;
  phishing_probability: number;
  reasons: string[];
  created_at: string;
  user_email: string;
  user_name: string;
}

const getVerdictBadgeVariant = (verdict?: string): 'success' | 'warning' | 'danger' | 'default' => {
  switch (verdict?.toLowerCase()) {
    case 'safe':
      return 'success';
    case 'suspicious':
      return 'warning';
    case 'dangerous':
    case 'phishing':
      return 'danger';
    default:
      return 'default';
  }
};

export function OrgAdminActivityPage() {
  const [activeTab, setActiveTab] = useState<'scans' | 'audit'>('scans');

  // User-wise Scans State
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [userScans, setUserScans] = useState<UserScan[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedVerdict, setSelectedVerdict] = useState<string>('');
  const [scanSearch, setScanSearch] = useState<string>('');
  const [isScansLoading, setIsScansLoading] = useState<boolean>(true);
  const [scansPage, setScansPage] = useState<number>(1);
  const [scansTotalPages, setScansTotalPages] = useState<number>(1);

  // Audit Logs State
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Load User Scans History
  const loadUserScans = async (isSilent = false) => {
    if (!isSilent) setIsScansLoading(true);
    try {
      const res = await api.orgAdminGetUserScans({
        user_id: selectedUser || undefined,
        verdict: selectedVerdict || undefined,
        search: scanSearch || undefined,
        page: scansPage,
        per_page: 15,
      });
      setUsers(res.users || []);
      setUserScans(res.scans || []);
      setScansTotalPages(res.pages || 1);
    } catch (err) {
      console.error('Failed to load user scans:', err);
    } finally {
      if (!isSilent) setIsScansLoading(false);
    }
  };

  useEffect(() => {
    loadUserScans(false);
    const interval = setInterval(() => {
      loadUserScans(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedUser, selectedVerdict, scansPage]);

  // Load Audit Logs
  useEffect(() => {
    const loadActivities = async () => {
      setIsAuditLoading(true);
      setAuditError(null);
      try {
        const response = await api.orgAdminActivity({ page: 1, per_page: 50 });
        setActivities(response.activities || []);
      } catch (err: any) {
        setAuditError(err.message || 'Failed to load audit log');
      } finally {
        setIsAuditLoading(false);
      }
    };
    loadActivities();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScansPage(1);
    loadUserScans();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Search History & Audit Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor user web navigation scans, threat verdicts, and organization activity stream
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setActiveTab('scans')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'scans'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            🔍 User Search History
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            📜 Audit Activity Stream
          </button>
        </div>
      </div>

      {activeTab === 'scans' ? (
        <Card variant="outlined" className="p-6 space-y-6">
          {/* Filters Bar */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Filter by User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setScansPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Organization Users ({users.length})</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Verdict Level
              </label>
              <select
                value={selectedVerdict}
                onChange={(e) => {
                  setSelectedVerdict(e.target.value);
                  setScansPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Verdicts</option>
                <option value="DANGEROUS">🚨 Dangerous / Phishing</option>
                <option value="SUSPICIOUS">⚠️ Suspicious</option>
                <option value="SAFE">✅ Safe</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                Search URL or Domain
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. google.com, paypal"
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                />
                <Button type="submit" variant="primary" size="sm">
                  Search
                </Button>
              </div>
            </div>
          </form>

          {/* User Scans List Table */}
          {isScansLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : userScans.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
              <span className="text-4xl mb-3 block">🔎</span>
              <p className="text-gray-700 dark:text-gray-300 font-semibold text-lg">No URL Scans Found</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                No search scan history matches your selected user or filter parameters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-3.5 px-4">User</th>
                    <th className="py-3.5 px-4">Scanned URL</th>
                    <th className="py-3.5 px-4">Verdict</th>
                    <th className="py-3.5 px-4">Risk Score</th>
                    <th className="py-3.5 px-4">Threat Indicators</th>
                    <th className="py-3.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                  {userScans.map((scan) => {
                    const verdictStr = (scan.verdict || 'safe').toLowerCase();
                    return (
                      <tr key={scan.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-gray-900 dark:text-gray-100">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{scan.user_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{scan.user_email}</p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-indigo-600 dark:text-indigo-400 max-w-xs truncate" title={scan.url}>
                          {scan.url}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={getVerdictBadgeVariant(verdictStr)} size="sm">
                            {verdictStr.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <span className={
                            scan.risk_score >= 70 ? 'text-red-600 dark:text-red-400' :
                            scan.risk_score >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                          }>
                            {scan.risk_score}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {scan.reasons && scan.reasons.length > 0 ? scan.reasons.join(', ') : 'No anomalies detected'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(scan.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {scansTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                disabled={scansPage <= 1}
                onClick={() => setScansPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Page {scansPage} of {scansTotalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={scansPage >= scansTotalPages}
                onClick={() => setScansPage((p) => Math.min(scansTotalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      ) : (
        /* Audit Activity Stream */
        <Card variant="outlined" className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>System Audit Log</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {isAuditLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent" />
              </div>
            ) : auditError ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm">
                {auditError}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No activity logs recorded yet.</div>
            ) : (
              <div className="space-y-4">
                {activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      📜
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{act.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {act.user ? `${act.user.first_name} ${act.user.last_name} (${act.user.email})` : 'System'} • {new Date(act.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}