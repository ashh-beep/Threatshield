import type { ScanRequest, ScanResult, ApiError } from '../types/scanner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10);

interface AnalyzeResponse {
  url: string;
  verdict: string;
  risk_score: number;
  risk_color: string;
  phishing_probability: number;
  prediction: number;
  reasons: string[];
  stages: {
    lexical: {
      verdict: string;
      risk_score: number;
      phishing_probability: number;
      reasons: string[];
      latency_ms: number;
    };
    threat_api: {
      in_openphish: boolean;
      feed_size: number;
      checked: boolean;
      error?: string;
      risk_score: number;
      latency_ms: number;
    };
    page_inspect: {
      status: string;
      result?: {
        suspicious_forms?: boolean;
        brand_impersonation?: boolean;
        suspicious_dom_patterns?: boolean;
        details?: string;
      };
    };
  };
}

interface PageInspectResponse {
  suspicious_forms?: boolean;
  brand_impersonation?: boolean;
  suspicious_dom_patterns?: boolean;
  details?: string;
}

class ScannerService {
  private abortController: AbortController | null = null;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    this.abortController = controller;

    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = {
          message: errorData.message || errorData.error || `Request failed with status ${response.status}`,
          code: errorData.code,
          status: response.status,
        };
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw { message: 'Request timed out', code: 'TIMEOUT' } as ApiError;
      }
      throw error;
    }
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async scanUrl(request: ScanRequest): Promise<ScanResult> {
    const [analyzeResponse, pageInspectResponse] = await Promise.allSettled([
      this.request<AnalyzeResponse>('/analyze', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
      this.request<PageInspectResponse>(`/page_inspect_result?url=${encodeURIComponent(request.url)}`),
    ]);

    const analyzeData = analyzeResponse.status === 'fulfilled' ? analyzeResponse.value : null;
    const pageInspectData = pageInspectResponse.status === 'fulfilled' ? pageInspectResponse.value : null;

    if (!analyzeData) {
      const reason = analyzeResponse.status === 'rejected' ? analyzeResponse.reason : null;
      console.error('Analyze request failed:', reason);
      const message = typeof reason === 'object' && reason?.message ? reason.message : 'Unable to complete the scan. Please try again.';
      throw { message, code: 'ANALYZE_FAILED' } as ApiError;
    }

    // Build summary from verdict and reasons
    const verdictLabel = this.mapVerdictLabel(analyzeData.verdict);
    const reasonText = analyzeData.reasons && analyzeData.reasons.length > 0
      ? analyzeData.reasons[0]
      : 'No specific indicators detected';
    const summary = `${verdictLabel}: ${reasonText}`;

    // Extract lexical analysis from stages
    const lexicalStage = analyzeData.stages?.lexical;
    const lexicalAnalysis = lexicalStage?.reasons ? lexicalStage.reasons.map((reason: string, idx: number) => ({
      name: `Indicator ${idx + 1}`,
      detected: true,
      description: reason,
      severity: 'medium' as const,
    })) : undefined;

    // Extract threat intelligence from stages
    const threatStage = analyzeData.stages?.threat_api;
    const threatIntelligence = threatStage ? {
      found: threatStage.in_openphish,
      sources: threatStage.in_openphish ? ['OpenPhish'] : undefined,
      details: threatStage.error || undefined,
    } : undefined;

    // Extract page inspection from stages or pageInspectData
    const pageInspectStage = analyzeData.stages?.page_inspect;
    const pageInspectResult = pageInspectStage?.result || pageInspectData;
    const pageInspection = pageInspectResult ? {
      suspiciousForms: pageInspectResult.suspicious_forms,
      brandImpersonation: pageInspectResult.brand_impersonation,
      suspiciousDomPatterns: pageInspectResult.suspicious_dom_patterns,
      details: pageInspectResult.details,
    } : undefined;

    return {
      url: analyzeData.url,
      verdict: this.mapVerdict(analyzeData.verdict),
      riskScore: analyzeData.risk_score,
      summary,
      lexicalAnalysis,
      threatIntelligence,
      pageInspection,
      reasons: analyzeData.reasons,
      timestamp: new Date().toISOString(),
    };
  }

  private mapVerdict(verdict: string): 'safe' | 'suspicious' | 'dangerous' {
    const normalized = verdict.toLowerCase();
    if (normalized === 'safe' || normalized === 'benign') return 'safe';
    if (normalized === 'suspicious' || normalized === 'warning') return 'suspicious';
    if (normalized === 'dangerous' || normalized === 'malicious' || normalized === 'phishing') return 'dangerous';
    return 'suspicious';
  }

  private mapVerdictLabel(verdict: string): string {
    const normalized = verdict.toLowerCase();
    if (normalized === 'safe' || normalized === 'benign') return 'Safe';
    if (normalized === 'suspicious' || normalized === 'warning') return 'Suspicious';
    if (normalized === 'dangerous' || normalized === 'malicious' || normalized === 'phishing') return 'Dangerous';
    return 'Unknown';
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }
}

export const scannerService = new ScannerService();