import { Card, CardContent } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Badge } from '../ui/Badge';
import { classNames } from '../../utils/helpers';

const scanSteps = [
  { id: 'lexical', label: 'URL Analysis', description: 'Analyzing URL structure and lexical features' },
  { id: 'threat', label: 'Threat Intelligence', description: 'Checking against threat intelligence databases' },
  { id: 'page', label: 'Page Inspection', description: 'Inspecting page content and behavior' },
] as const;

type ScanStepId = typeof scanSteps[number]['id'];

interface ScanningStateProps {
  currentStep?: ScanStepId;
}

export function ScanningState({ currentStep = 'lexical' }: ScanningStateProps) {
  const currentIndex = scanSteps.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Scan progress">
      {scanSteps.map((step, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        const isPending = index > currentIndex;

        return (
          <Card key={step.id} variant="outlined" className={classNames(
            'transition-all duration-300',
            isActive && 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg shadow-indigo-500/10',
            isComplete && 'border-green-200 dark:border-green-800',
            isPending && 'border-gray-200 dark:border-gray-700 opacity-60'
          )}>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4">
                <div
                  className={classNames(
                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                    isActive && 'bg-indigo-100 dark:bg-indigo-900/30 animate-pulse',
                    isComplete && 'bg-green-100 dark:bg-green-900/30',
                    isPending && 'bg-gray-100 dark:bg-gray-700'
                  )}
                  aria-hidden="true"
                >
                  {isComplete ? (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : isActive ? (
                    <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={classNames(
                      'font-medium',
                      isActive && 'text-indigo-700 dark:text-indigo-300',
                      isComplete && 'text-green-700 dark:text-green-300',
                      isPending && 'text-gray-600 dark:text-gray-400'
                    )}>
                      {step.label}
                    </span>
                    {isActive && (
                      <Badge variant="info" size="sm">In Progress</Badge>
                    )}
                    {isComplete && (
                      <Badge variant="success" size="sm">Complete</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{step.description}</p>
                </div>
                <div className="w-32 hidden sm:block">
                  <Progress
                    value={isComplete ? 100 : isActive ? 50 : 0}
                    max={100}
                    size="sm"
                    variant={isActive ? 'default' : isComplete ? 'success' : 'default'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-center gap-4 p-4">
        <Progress value={(currentIndex + 1) / scanSteps.length * 100} max={100} size="md" variant="default" showLabel className="w-64" />
      </div>
    </div>
  );
}

export function ScanningSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <Card key={i} variant="outlined" className="border-gray-200 dark:border-gray-700 animate-pulse">
          <CardContent className="pt-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="mt-1 h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="w-32 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}