import { useState, useRef, useCallback, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Input } from '@components/ui/Input';
import { Button } from '@components/ui/Button';
import { isValidUrl, normalizeUrl } from '@utils/helpers';
import type { ScanState } from '@type-defs/scanner';

interface ScannerFormProps {
  onScan: (url: string) => void;
  onClear: () => void;
  state: ScanState;
  error: string | null;
  resetKey?: number;
}

export function ScannerForm({ onScan, onClear, state, error, resetKey }: ScannerFormProps) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (resetKey !== undefined) {
      setUrl('');
      setValidationError(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }, [resetKey]);

  const handleClear = useCallback(() => {
    setUrl('');
    setValidationError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear();
    inputRef.current?.focus();
  }, [onClear]);

  const validateUrl = useCallback((value: string): string | null => {
    if (!value.trim()) return 'Please enter a URL';
    const normalized = normalizeUrl(value);
    if (!isValidUrl(normalized)) return 'Please enter a valid URL (e.g., https://example.com)';
    return null;
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || state === 'scanning') return;

    const err = validateUrl(url);
    if (err) {
      setValidationError(err);
      inputRef.current?.focus();
      return;
    }

    setValidationError(null);
    isSubmittingRef.current = true;
    onScan(normalizeUrl(url));
  }, [url, state, validateUrl, onScan]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }, [handleSubmit]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (validationError) {
      const err = validateUrl(value);
      setValidationError(err);
    }
  }, [validationError, validateUrl]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    setUrl(pasted);
    const err = validateUrl(pasted);
    setValidationError(err);
  }, [validateUrl]);

  const isDisabled = state === 'scanning' || isSubmittingRef.current;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto" noValidate>
      <div className="relative" role="search" aria-label="URL Scanner">
        <label htmlFor="url-input" className="sr-only">
          Enter URL to scan
        </label>
        <Input
          ref={inputRef}
          id="url-input"
          type="url"
          value={url}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="https://example.com"
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
          rightIcon={
            state === 'scanning' && (
              <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )
          }
          error={validationError ?? error ?? undefined}
          disabled={isDisabled}
          aria-busy={state === 'scanning'}
          aria-live={state === 'scanning' ? 'polite' : 'off'}
        />
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={isDisabled}
          loading={state === 'scanning'}
          className="min-w-[160px]"
        >
          {state === 'scanning' ? 'Scanning...' : 'Scan URL'}
        </Button>

        {url && state !== 'scanning' && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleClear}
            disabled={isDisabled}
            aria-label="Clear URL input and scan result"
          >
            Clear
          </Button>
        )}
        {(state === 'success' || state === 'error') && !url && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleClear}
            disabled={isDisabled}
            aria-label="Clear scan result"
          >
            Clear
          </Button>
        )}
      </div>

      {error && state === 'error' && (
        <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" role="alert">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Scan Failed</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setValidationError(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}