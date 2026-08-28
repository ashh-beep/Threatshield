import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ScannerForm, ScanResultCard, DetailedAnalysisModal, ScanningState } from '@components/scanner';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { useScanner } from '@hooks/useScanner';
import { useAuth } from '@context/AuthContext';
import { api, type Scan } from '@services/api';
import { classNames, getVerdictLabel, formatRiskScore } from '@utils/helpers';
import type { ScanState, ScanResult } from '@type-defs/scanner';

const STEP_ORDER: ScanState[] = ['validating', 'scanning', 'scanning', 'scanning'];

export function DashboardPage() {
  const { user, isOrgAdmin, isSuperAdmin, primaryOrgId } = useAuth();
  const { state, result, error, scan, reset } = useScanner();
  const [showDetails, setShowDetails] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scans, setScans] = useState<Scan[]>([]);
  const [stats, setStats] = useState<{ total: number; dangerous: number; suspicious: number; safe: number } | null>(null);
  const [isLoadingScans, setIsLoadingScans] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSavingScan, setIsSavingScan] = useState(false);
  const [savedScanId, setSavedScanId] = useState<string | undefined>(undefined);
  const [scannerResetKey, setScannerResetKey] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle newScan navigation state
  useEffect(() => {
    if (location.state?.newScan === true) {
      // Reset all scanner state
      reset();
      setSavedScanId(undefined);
      setShowDetails(false);
      // Increment reset key to clear ScannerForm input
      setScannerResetKey(prev => prev + 1);
      // Replace the state to clear newScan flag
      navigate('/dashboard', { replace: true, state: undefined });
    }
  }, [location, navigate, reset]);

  const fetchScans = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingScans(true);
    try {
      const orgId = primaryOrgId || undefined;
      const response = await api.listScans({ page: currentPage, per_page: 10, org_id: orgId });
      setScans(response.data ?? []);
      setTotalPages(response.pagination?.pages ?? 1);
    } catch (err) {
      console.error('Failed to fetch scans:', err);
    } finally {
      if (!isSilent) setIsLoadingScans(false);
    }
  }, [currentPage, primaryOrgId]);

  const fetchStats = useCallback(async () => {
    try {
      const orgId = primaryOrgId || undefined;
      const response = await api.getScanStats(orgId);
      setStats(response);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [primaryOrgId]);

  useEffect(() => {
    fetchScans(false);
    fetchStats();
    const pollInterval = setInterval(() => {
      fetchScans(true);
      fetchStats();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, [fetchScans, fetchStats]);

  useEffect(() => {
    if (state === 'scanning') {
      const interval = setInterval(() => {
        setScanStepIndex(prev => (prev + 1) % 3);
      }, 2000);
      return () => clearInterval(interval);
    }
    setScanStepIndex(0);
  }, [state]);

  const handleScan = useCallback(async (url: string) => {
    setShowDetails(false);
    setSavedScanId(undefined);
    setScanStepIndex(0);
    const scanResult = await scan(url);
    
    if (scanResult) {
      setIsSavingScan(true);
      try {
        const orgId = primaryOrgId || undefined;
        const pageInspectResult = scanResult.pageInspection ? {
          suspicious_forms: scanResult.pageInspection.suspiciousForms,
          brand_impersonation: scanResult.pageInspection.brandImpersonation,
          suspicious_dom_patterns: scanResult.pageInspection.suspiciousDomPatterns,
          details: scanResult.pageInspection.details,
        } : undefined;
        
        const scanData = {
          url: scanResult.url,
          verdict: scanResult.verdict,
          risk_score: scanResult.riskScore,
          risk_color: scanResult.verdict === 'safe' ? 'green' : scanResult.verdict === 'suspicious' ? 'yellow' : 'red',
          phishing_probability: scanResult.riskScore / 100,
          prediction: scanResult.verdict === 'safe' ? -1 : 1,
          reasons: scanResult.reasons || [],
          stages: {
            lexical: {
              verdict: scanResult.verdict,
              risk_score: scanResult.riskScore,
              phishing_probability: scanResult.riskScore / 100,
              reasons: scanResult.reasons || [],
              latency_ms: 0
            },
            threat_api: {
              in_openphish: scanResult.threatIntelligence?.found || false,
              feed_size: 0,
              checked: true,
              risk_score: scanResult.threatIntelligence?.found ? 10 : 1,
              latency_ms: 0
            },
            page_inspect: scanResult.pageInspection || {}
          },
          page_inspect_result: pageInspectResult,
          organization_id: orgId
        };
        const response = await api.createScan(scanData);
        
        // Refresh dashboard stats and scan history after successful save
        await Promise.all([fetchStats(), fetchScans()]);
        
        // Store the saved scan ID for View Details
        setSavedScanId(response.scan.id);
        setShowDetails(true);
      } catch (err) {
        console.error('Failed to save scan:', err);
      } finally {
        setIsSavingScan(false);
      }
    }
  }, [scan, primaryOrgId, fetchStats, fetchScans]);

  const handleClear = useCallback(() => {
    reset();
    setSavedScanId(undefined);
    setShowDetails(false);
    setScannerResetKey(prev => prev + 1);
  }, [reset]);

  const handleViewDetails = useCallback((scanId?: string) => {
    if (scanId) {
      navigate(`/scan/${scanId}`);
    }
  }, [navigate]);

  const currentStep = state === 'scanning' ? STEP_ORDER[scanStepIndex] || 'scanning' : undefined;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
                Welcome back, {user?.first_name}
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Your personal URL security dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isSuperAdmin ? 'danger' : isOrgAdmin ? 'warning' : 'info'} size="md" dot>
                {isSuperAdmin ? 'Super Admin' : isOrgAdmin ? 'Org Admin' : 'User'}
              </Badge>
            </div>
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
                <CardContent className="pt-0 text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Scans</div>
                </CardContent>
              </Card>
              <Card variant="outlined" className="border-red-200 dark:border-red-800">
                <CardContent className="pt-0 text-center">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.dangerous}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Dangerous</div>
                </CardContent>
              </Card>
              <Card variant="outlined" className="border-yellow-200 dark:border-yellow-800">
                <CardContent className="pt-0 text-center">
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.suspicious}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Suspicious</div>
                </CardContent>
              </Card>
              <Card variant="outlined" className="border-green-200 dark:border-green-800">
                <CardContent className="pt-0 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.safe}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Safe</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick scanner */}
          <Card variant="elevated" className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Quick Scan</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScannerForm onScan={handleScan} onClear={handleClear} state={state} error={error} resetKey={scannerResetKey} />
              {state === 'scanning' && (
                <section aria-labelledby="scanning-heading" className="animate-fade-in mt-6">
                  <h2 id="scanning-heading" className="sr-only">Scanning in Progress</h2>
                  <ScanningState currentStep={currentStep as any} />
                </section>
              )}
              {state === 'success' && result && !isSavingScan && (
                <section aria-labelledby="result-heading" className="animate-slide-up mt-6">
                  <h2 id="result-heading" className="sr-only">Scan Result</h2>
                  <ScanResultCard result={result} onViewDetails={handleViewDetails} scanId={savedScanId} />
                </section>
              )}
              {isSavingScan && result && (
                <section aria-labelledby="saving-heading" className="animate-slide-up mt-6">
                  <h2 id="saving-heading" className="sr-only">Saving Scan</h2>
                  <div className="flex items-center justify-center gap-3 p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
                    <span className="text-gray-600 dark:text-gray-400">Saving scan to history...</span>
                  </div>
                </section>
              )}
              {state === 'error' && (
                <section aria-labelledby="error-heading" className="animate-fade-in mt-6">
                  <h2 id="error-heading" className="sr-only">Scan Error</h2>
                  <Card variant="outlined" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="pt-0">
                      <div className="text-center py-8">
                        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Unable to Complete Scan</h3>
                        <p className="text-red-700 dark:text-red-300 mb-6 max-w-md mx-auto">{error}</p>
                        <Button variant="primary" onClick={handleClear} className="min-w-[160px]">
                          Try Again
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}
            </CardContent>
          </Card>
        </header>

        {/* Scan History */}
        <section aria-labelledby="history-heading">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 id="history-heading" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Scan History
            </h2>
            <Button variant="primary" size="sm" onClick={handleClear}>
              New Scan
            </Button>
          </div>

          {isLoadingScans ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} variant="outlined" className="border-gray-200 dark:border-gray-700 animate-pulse">
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <div className="flex-1">
                        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="mt-1 h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (scans?.length ?? 0) === 0 ? (
            <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
              <CardContent className="pt-0 text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No scans yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Start by scanning a URL above</p>
                <Button variant="primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  Scan Your First URL
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(scans ?? []).map((scan) => (
                <Card key={scan.id} variant="outlined" className={classNames(
                  'transition-shadow hover:shadow-md',
                  scan.verdict === 'safe' && 'border-green-200 dark:border-green-800',
                  scan.verdict === 'suspicious' && 'border-yellow-200 dark:border-yellow-800',
                  scan.verdict === 'dangerous' && 'border-red-200 dark:border-red-800'
                )}>
                  <CardContent className="pt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
                      <div className="flex items-center gap-3">
                        <div className={classNames(
                          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                          scan.verdict === 'safe' && 'bg-green-100 dark:bg-green-900/30',
                          scan.verdict === 'suspicious' && 'bg-yellow-100 dark:bg-yellow-900/30',
                          scan.verdict === 'dangerous' && 'bg-red-100 dark:bg-red-900/30'
                        )} aria-hidden="true">
                          <span className="text-xl">
                            {scan.verdict === 'safe' ? '✓' : scan.verdict === 'suspicious' ? '⚠' : '✕'}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={scan.verdict === 'safe' ? 'success' : scan.verdict === 'suspicious' ? 'warning' : 'danger'} size="md" dot>
                              {getVerdictLabel(scan.verdict)}
                            </Badge>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Risk: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRiskScore(scan.risk_score)}</span>
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-xs sm:max-w-md">{scan.url}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:ml-auto">
                        <span className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(scan.created_at).toLocaleString()}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => handleViewDetails(scan.id)}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
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
          )}
        </section>

        <DetailedAnalysisModal result={result} isOpen={showDetails} onClose={() => setShowDetails(false)} />
      </div>
    </div>
  );
}