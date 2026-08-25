import { useState, useCallback, useEffect } from 'react';
import { ScannerForm, ScanResultCard, DetailedAnalysisModal, ScanningState } from '@components/scanner';
import { Card, CardContent } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { useScanner } from '@hooks/useScanner';
import type { ScanState } from '@type-defs/scanner';

const STEP_ORDER: ScanState[] = ['validating', 'scanning', 'scanning', 'scanning'];

export function ScannerPage() {
  const { state, result, error, scan, reset } = useScanner();
  const [showDetails, setShowDetails] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);

  useEffect(() => {
    if (state === 'scanning') {
      const interval = setInterval(() => {
        setScanStepIndex(prev => (prev + 1) % 3);
      }, 2000);
      return () => clearInterval(interval);
    }
    setScanStepIndex(0);
  }, [state]);

  const handleScan = useCallback((url: string) => {
    setShowDetails(false);
    setScanStepIndex(0);
    scan(url);
  }, [scan]);

  const handleTryAgain = useCallback(() => {
    reset();
  }, [reset]);

  const handleViewDetails = useCallback(() => {
    setShowDetails(true);
  }, []);

  const currentStep = state === 'scanning' ? STEP_ORDER[scanStepIndex] || 'scanning' : undefined;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 mb-6" aria-hidden="true">
            <svg className="w-10 h-10 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            ThreatShield
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Advanced URL security scanner. Detect phishing, malware, and suspicious links before you click.
          </p>
        </header>

        <main className="space-y-6" role="main">
          <section aria-labelledby="scanner-heading">
            <h2 id="scanner-heading" className="sr-only">URL Scanner</h2>
            <ScannerForm onScan={handleScan} onClear={reset} state={state} error={error} />
          </section>

          {state === 'scanning' && (
            <section aria-labelledby="scanning-heading" className="animate-fade-in">
              <h2 id="scanning-heading" className="sr-only">Scanning in Progress</h2>
              <ScanningState currentStep={currentStep as any} />
            </section>
          )}

          {state === 'success' && result && (
            <section aria-labelledby="result-heading" className="animate-slide-up">
              <h2 id="result-heading" className="sr-only">Scan Result</h2>
              <ScanResultCard result={result} onViewDetails={handleViewDetails} />
            </section>
          )}

          {state === 'error' && (
            <section aria-labelledby="error-heading" className="animate-fade-in">
              <h2 id="error-heading" className="sr-only">Scan Error</h2>
              <Card variant="outlined" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <CardContent className="pt-0">
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Unable to Complete Scan</h3>
                    <p className="text-red-700 dark:text-red-300 mb-6 max-w-md mx-auto">{error}</p>
                    <Button variant="primary" onClick={handleTryAgain} className="min-w-[160px]">
                      Try Again
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {state === 'idle' && (
            <section className="grid gap-6 md:grid-cols-3" aria-labelledby="features-heading">
              <h2 id="features-heading" className="sr-only">Key Features</h2>
              {[
                {
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                  title: 'URL Analysis',
                  desc: 'Deep lexical analysis of URL structure, subdomains, and patterns'
                },
                {
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: 'Threat Intelligence',
                  desc: 'Real-time checks against multiple threat intelligence feeds'
                },
                {
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: 'Page Inspection',
                  desc: 'Dynamic analysis of page content, forms, and behavior'
                },
              ].map((feature, index) => (
                <Card key={index} variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                  <CardContent className="pt-0 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </main>

        <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>ThreatShield - Protecting you from phishing and malicious URLs</p>
        </footer>
      </div>

      <DetailedAnalysisModal result={result} isOpen={showDetails} onClose={() => setShowDetails(false)} />
    </div>
  );
}