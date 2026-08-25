import { useState, useCallback, useRef, useEffect } from 'react';
import type { ScannerState, ScanResult } from '@type-defs/scanner';
import { scannerService } from '@services/scannerService';

export function useScanner() {
  const [state, setState] = useState<ScannerState>({
    state: 'idle',
    result: null,
    error: null,
    isLoading: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState({
      state: 'idle',
      result: null,
      error: null,
      isLoading: false,
    });
  }, []);

  const scan = useCallback(async (url: string): Promise<ScanResult | null> => {
    if (state.state === 'scanning') return null;

    setState(prev => ({
      ...prev,
      state: 'scanning',
      isLoading: true,
      error: null,
    }));

    try {
      const result = await scannerService.scanUrl({ url });

      setState({
        state: 'success',
        result,
        error: null,
        isLoading: false,
      });
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }

      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unable to complete the scan. Please try again.';

      setState({
        state: 'error',
        result: null,
        error: errorMessage,
        isLoading: false,
      });
      return null;
    }
  }, [state.state]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    scannerService.cancel();
    setState(prev => ({
      ...prev,
      state: 'idle',
      isLoading: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      scannerService.cancel();
    };
  }, []);

  return {
    ...state,
    scan,
    cancel,
    reset,
  };
}