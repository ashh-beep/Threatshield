import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import { api, type Scan } from '@services/api';
import { useAuth } from '@context/AuthContext';
import { classNames, getVerdictLabel, formatRiskScore, getVerdictColor } from '@utils/helpers';

export function ScanDetailPage() {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const { isSuperAdmin, isOrgAdmin, primaryOrgId } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleNewScan = useCallback(() => {
    console.log('NEW SCAN CLICKED');
    navigate('/dashboard', { state: { newScan: true } });
  }, [navigate]);

  useEffect(() => {
    if (!scanId) return;

    const fetchScan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const orgId = primaryOrgId || undefined;
        const response = await api.getScan(scanId);
        const scanData = response.scan;

        // Check access permissions
        const hasAccess = isSuperAdmin || 
          scanData.user_id === scanData.user_id || // owner
          (scanData.organization_id && scanData.organization_id === primaryOrgId);

        if (!hasAccess && !isSuperAdmin) {
          setError('Access denied');
          return;
        }

        setScan(scanData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scan');
      } finally {
        setIsLoading(false);
      }
    };

    fetchScan();
  }, [scanId, isSuperAdmin, isOrgAdmin, primaryOrgId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="mt-1 h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0">
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Card variant="outlined" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardContent className="pt-0 py-12">
              <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Unable to Load Scan</h2>
              <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
              <Link to="/dashboard">
                <Button variant="primary">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!scan) {
    return null;
  }

  const verdictColor = getVerdictColor(scan.verdict);
  const verdictLabel = getVerdictLabel(scan.verdict);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Scan Details</h1>
              <p className="text-gray-600 dark:text-gray-400">Comprehensive analysis results</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={handleNewScan}>
              New Scan
            </Button>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Result Card */}
        <Card variant="outlined" className={classNames(
          scan.verdict === 'safe' && 'border-green-200 dark:border-green-800',
          scan.verdict === 'suspicious' && 'border-yellow-200 dark:border-yellow-800',
          scan.verdict === 'dangerous' && 'border-red-200 dark:border-red-800'
        )}>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6">
              <div className="flex items-center gap-4">
                <div className={classNames(
                  'flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center',
                  scan.verdict === 'safe' && 'bg-green-100 dark:bg-green-900/30',
                  scan.verdict === 'suspicious' && 'bg-yellow-100 dark:bg-yellow-900/30',
                  scan.verdict === 'dangerous' && 'bg-red-100 dark:bg-red-900/30'
                )} aria-hidden="true">
                  <span className="text-3xl">
                    {scan.verdict === 'safe' ? '✓' : scan.verdict === 'suspicious' ? '⚠' : '✕'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <Badge variant={scan.verdict === 'safe' ? 'success' : scan.verdict === 'suspicious' ? 'warning' : 'danger'} size="lg" dot>
                      {verdictLabel}
                    </Badge>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Risk Score: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRiskScore(scan.risk_score)}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-xs sm:max-w-md">{scan.url}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:ml-auto">
                <div className="w-40 hidden sm:block">
                  <Progress value={scan.risk_score} max={100} size="sm" 
                    variant={scan.verdict === 'safe' ? 'success' : scan.verdict === 'suspicious' ? 'warning' : 'danger'} 
                    showLabel 
                  />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: verdictColor }}>{formatRiskScore(scan.risk_score)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scanned on {new Date(scan.created_at).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Analysis Sections */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* Scan Metadata */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-base">Scan Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Scan ID</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100 break-all">{scan.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">URL</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100 break-all">{scan.url}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Verdict</p>
                  <Badge variant={scan.verdict === 'safe' ? 'success' : scan.verdict === 'suspicious' ? 'warning' : 'danger'} size="md" dot>
                    {verdictLabel}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Risk Score</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{formatRiskScore(scan.risk_score)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Phishing Probability</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{(scan.phishing_probability * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">ML Prediction</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{scan.prediction === 1 ? 'Phishing' : 'Safe'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 dark:text-gray-400">Timestamp</p>
                  <p className="font-mono text-gray-900 dark:text-gray-100">{new Date(scan.created_at).toLocaleString()}</p>
                </div>
                {scan.organization_id && (
                  <div className="col-span-2">
                    <p className="text-gray-500 dark:text-gray-400">Organization ID</p>
                    <p className="font-mono text-gray-900 dark:text-gray-100">{scan.organization_id}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Risk Progress */}
          <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-base">Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Overall Risk</span>
                  <span className="font-semibold" style={{ color: verdictColor }}>{formatRiskScore(scan.risk_score)}</span>
                </div>
                <Progress value={scan.risk_score} max={100} size="md" 
                  variant={scan.verdict === 'safe' ? 'success' : scan.verdict === 'suspicious' ? 'warning' : 'danger'} 
                  showLabel 
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Phishing Probability</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{(scan.phishing_probability * 100).toFixed(2)}%</span>
                </div>
                <Progress value={scan.phishing_probability * 100} max={100} size="md" variant="danger" showLabel />
              </div>
            </CardContent>
          </Card>

          {/* Reasons */}
          {scan.reasons && scan.reasons.length > 0 && (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Detection Reasons</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2" role="list">
                  {scan.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Stages Details */}
          {scan.stages && Object.keys(scan.stages).length > 0 && (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Analysis Stages</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {Object.entries(scan.stages).map(([stageName, stageData]: [string, any]) => (
                  <div key={stageName} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize mb-2">{stageName.replace('_', ' ')}</h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-64">
                      {JSON.stringify(stageData, null, 2)}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Page Inspection Result */}
          {scan.page_inspect_result && (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Page Inspection</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-96">
                  {JSON.stringify(scan.page_inspect_result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}