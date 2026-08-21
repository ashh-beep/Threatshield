import { useState, useCallback, useRef, useEffect } from 'react';
import type { ScannerState, ScanResult } from '@type-defs/scanner';
import { scannerService } from '@services/scannerService';
import { mockScannerService } from '@services/mockScannerService';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_BASE_URL;

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

    const service = USE_MOCK ? mockScannerService : scannerService;

    try {
      const result = await service.scanUrl({ url });

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
    if (!USE_MOCK) {
      scannerService.cancel();
    }
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
      if (!USE_MOCK) {
        scannerService.cancel();
      }
    };
  }, []);

  return {
    ...state,
    scan,
    cancel,
    reset,
  };
}