import { ModalProvider, ModalClose } from '@components/ui/Modal';
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import { Button } from '@components/ui/Button';
import { classNames, getVerdictColor, formatRiskScore } from '@utils/helpers';
import type { ScanResult, Verdict, LexicalIndicator } from '@type-defs/scanner';

interface DetailedAnalysisModalProps {
  result: ScanResult | null;
  isOpen: boolean;
  onClose: () => void;
}

const verdictLabels: Record<Verdict, string> = {
  safe: 'Safe',
  suspicious: 'Suspicious',
  dangerous: 'Dangerous',
};

const verdictDescriptions: Record<Verdict, string> = {
  safe: 'No threats detected. This URL appears to be safe to visit.',
  suspicious: 'This URL shows suspicious characteristics. Exercise caution and verify the destination before proceeding.',
  dangerous: 'This URL is confirmed as malicious/phishing. Do not visit this site.',
};

function IndicatorRow({ name, detected, description, severity = 'medium' }: LexicalIndicator) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center flex-col" aria-hidden="true">
        {detected ? (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>
          <Badge variant={detected ? 'danger' : 'success'} size="sm">
            {detected ? 'Detected' : 'Clean'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        {detected && (
          <Badge variant={severity === 'high' ? 'danger' : severity === 'medium' ? 'warning' : 'info'} size="sm" className="mt-1">
            Severity: {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </Badge>
        )}
      </div>
    </div>
  );
}

function AnalysisSection({ title, icon, children, emptyMessage }: { title: string; icon: React.ReactNode; children: React.ReactNode; emptyMessage: string }) {
  return (
    <Card variant="outlined" className="border-gray-200 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400" aria-hidden="true">{icon}</span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {children || <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{emptyMessage}</p>}
      </CardContent>
    </Card>
  );
}

function DetailedAnalysisContent({ result, onClose }: { result: ScanResult; onClose: () => void }) {
  const { verdict, riskScore, url, lexicalAnalysis, threatIntelligence, pageInspection, reasons, timestamp } = result;
  const color = getVerdictColor(verdict);

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div
              className={classNames(
                'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                verdict === 'safe' && 'bg-green-100 dark:bg-green-900/30',
                verdict === 'suspicious' && 'bg-yellow-100 dark:bg-yellow-900/30',
                verdict === 'dangerous' && 'bg-red-100 dark:bg-red-900/30'
              )}
              aria-hidden="true"
            >
              <span className="text-2xl">
                {verdict === 'safe' ? '✓' : verdict === 'suspicious' ? '⚠' : '✕'}
              </span>
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {verdict === 'dangerous' ? 'Dangerous Website Detected' : verdictLabels[verdict]}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{verdictDescriptions[verdict]}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 sm:mt-0 sm:ml-auto">
            <div className="w-24 hidden sm:block">
              <Progress value={riskScore} max={100} size="sm" variant={verdict === 'safe' ? 'success' : verdict === 'suspicious' ? 'warning' : 'danger'} showLabel />
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color }}>{formatRiskScore(riskScore)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
            </div>
          </div>
        </div>
        <ModalClose>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </ModalClose>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className="font-mono text-sm text-gray-900 dark:text-gray-100 break-all">{url}</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Scanned: {new Date(timestamp).toLocaleString()}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <AnalysisSection
            title="URL Analysis"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            emptyMessage="No lexical analysis data available"
          >
            {lexicalAnalysis && lexicalAnalysis.length > 0 ? (
              <div className="space-y-3">
                {lexicalAnalysis.map((indicator, index) => (
                  <IndicatorRow key={index} {...indicator} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No lexical analysis data available</p>
            )}
          </AnalysisSection>

          <AnalysisSection
            title="Threat Intelligence"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            emptyMessage="No threat intelligence data available"
          >
            {threatIntelligence ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: threatIntelligence.found ? 'rgb(254 226 226)' : 'rgb(220 252 231)', borderColor: threatIntelligence.found ? 'rgb(254 202 202)' : 'rgb(167 243 208)' }}>
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" aria-hidden="true">
                    {threatIntelligence.found ? (
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: threatIntelligence.found ? 'rgb(185 28 28)' : 'rgb(21 128 61)' }}>
                      {threatIntelligence.found ? 'Threat Found' : 'No Threats Found'}
                    </p>
                    <p className="text-sm" style={{ color: threatIntelligence.found ? 'rgb(220 38 38)' : 'rgb(22 163 74)' }}>
                      {threatIntelligence.details || (threatIntelligence.found ? 'This URL was found in threat intelligence databases' : 'No matches in threat intelligence databases')}
                    </p>
                  </div>
                </div>
                {threatIntelligence.found && threatIntelligence.sources && threatIntelligence.sources.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sources:</p>
                    <div className="flex flex-wrap gap-2">
                      {threatIntelligence.sources.map((source, index) => (
                        <Badge key={index} variant="default" size="sm">{source}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No threat intelligence data available</p>
            )}
          </AnalysisSection>

          <AnalysisSection
            title="Page Inspection"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            emptyMessage="No page inspection data available"
          >
            {pageInspection && (pageInspection.suspiciousForms || pageInspection.brandImpersonation || pageInspection.suspiciousDomPatterns) ? (
              <div className="space-y-3">
                {pageInspection.suspiciousForms !== undefined && (
                  <IndicatorRow
                    name="Suspicious Forms"
                    detected={pageInspection.suspiciousForms}
                    description={pageInspection.suspiciousForms ? 'Forms with suspicious actions or credential fields detected' : 'No suspicious forms detected'}
                    severity={pageInspection.suspiciousForms ? 'high' : 'low'}
                  />
                )}
                {pageInspection.brandImpersonation !== undefined && (
                  <IndicatorRow
                    name="Brand Impersonation"
                    detected={pageInspection.brandImpersonation}
                    description={pageInspection.brandImpersonation ? 'Page mimics a known brand or login page' : 'No brand impersonation detected'}
                    severity={pageInspection.brandImpersonation ? 'high' : 'low'}
                  />
                )}
                {pageInspection.suspiciousDomPatterns !== undefined && (
                  <IndicatorRow
                    name="Suspicious DOM Patterns"
                    detected={pageInspection.suspiciousDomPatterns}
                    description={pageInspection.suspiciousDomPatterns ? 'Obfuscated scripts or suspicious DOM manipulation detected' : 'No suspicious DOM patterns detected'}
                    severity={pageInspection.suspiciousDomPatterns ? 'medium' : 'low'}
                  />
                )}
                {pageInspection.details && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50">{pageInspection.details}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No page inspection data available</p>
            )}
          </AnalysisSection>

          {reasons && reasons.length > 0 && (
            <AnalysisSection
              title="Detection Reasons"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              emptyMessage="No detection reasons provided"
            >
              <ul className="space-y-2" role="list">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 001.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{reason}</span>
                  </li>
                ))}
              </ul>
            </AnalysisSection>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

export function DetailedAnalysisModal({ result, isOpen, onClose }: DetailedAnalysisModalProps) {
  return (
    <ModalProvider closeOnOverlayClick={true} closeOnEscape={true}>
      {isOpen && result && (
        <DetailedAnalysisContent result={result} onClose={onClose} />
      )}
    </ModalProvider>
  );
}