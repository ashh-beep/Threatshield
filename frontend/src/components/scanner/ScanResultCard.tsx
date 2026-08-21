import { Card, CardContent } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import { Button } from '@components/ui/Button';
import { classNames, getVerdictLabel, formatRiskScore } from '@utils/helpers';
import type { ScanResult } from '@type-defs/scanner';

interface ScanResultCardProps {
  result: ScanResult;
  onViewDetails: (scanId?: string) => void;
  scanId?: string;
}

const verdictIcons = {
  safe: (
    <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  suspicious: (
    <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  dangerous: (
    <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
};

const verdictBgColors = {
  safe: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  suspicious: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  dangerous: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};

export function ScanResultCard({ result, onViewDetails, scanId }: ScanResultCardProps) {
  const { verdict, riskScore, url, summary, timestamp } = result;
  const label = getVerdictLabel(verdict);

  const handleViewDetails = () => {
    onViewDetails(scanId);
  };

  return (
    <Card variant="outlined" className={classNames(verdictBgColors[verdict])}>
      <CardContent className="pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={classNames(
                'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
                verdict === 'safe' && 'bg-green-100 dark:bg-green-900/30',
                verdict === 'suspicious' && 'bg-yellow-100 dark:bg-yellow-900/30',
                verdict === 'dangerous' && 'bg-red-100 dark:bg-red-900/30'
              )}
              aria-hidden="true"
            >
              {verdictIcons[verdict]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={verdict === 'safe' ? 'success' : verdict === 'suspicious' ? 'warning' : 'danger'} size="lg" dot>
                  {label}
                </Badge>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Risk Score: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRiskScore(riskScore)}</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-xs sm:max-w-md">{url}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:ml-auto">
            <div className="hidden sm:block w-32">
              <Progress value={riskScore} max={100} size="sm" variant={verdict === 'safe' ? 'success' : verdict === 'suspicious' ? 'warning' : 'danger'} />
            </div>
            <Button variant="outline" size="md" onClick={handleViewDetails}>
              View Detailed Analysis
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">{summary}</p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Scanned on {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}