export type Verdict = 'safe' | 'suspicious' | 'dangerous';

export interface LexicalIndicator {
  name: string;
  detected: boolean;
  description: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface ThreatIntelligenceResult {
  found: boolean;
  sources?: string[];
  details?: string;
}

export interface PageInspectionResult {
  suspiciousForms?: boolean;
  brandImpersonation?: boolean;
  suspiciousDomPatterns?: boolean;
  details?: string;
}

export interface ScanResult {
  url: string;
  verdict: Verdict;
  riskScore: number;
  summary: string;
  lexicalAnalysis?: LexicalIndicator[];
  threatIntelligence?: ThreatIntelligenceResult;
  pageInspection?: PageInspectionResult;
  reasons?: string[];
  timestamp: string;
}

export interface ScanRequest {
  url: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export type ScanState = 'idle' | 'validating' | 'scanning' | 'success' | 'error';

export interface ScannerState {
  state: ScanState;
  result: ScanResult | null;
  error: string | null;
  isLoading: boolean;
}