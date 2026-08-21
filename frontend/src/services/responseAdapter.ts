import type { ScanResult, Verdict, LexicalIndicator, ThreatIntelligenceResult, PageInspectionResult } from '../types/scanner';

interface BackendScanResponse {
  url: string;
  verdict: string;
  risk_score: number;
  summary: string;
  lexical_analysis?: Array<{
    name: string;
    detected: boolean;
    description: string;
    severity?: string;
  }>;
  threat_intelligence?: {
    found: boolean;
    sources?: string[];
    details?: string;
  };
  page_inspection?: {
    suspicious_forms?: boolean;
    brand_impersonation?: boolean;
    suspicious_dom_patterns?: boolean;
    details?: string;
  };
  reasons?: string[];
  timestamp: string;
}

function mapVerdict(verdict: string): Verdict {
  const normalized = verdict.toLowerCase();
  if (normalized === 'safe' || normalized === 'benign') return 'safe';
  if (normalized === 'suspicious' || normalized === 'warning') return 'suspicious';
  if (normalized === 'dangerous' || normalized === 'malicious' || normalized === 'phishing') return 'dangerous';
  return 'suspicious';
}

function mapLexicalAnalysis(analysis?: BackendScanResponse['lexical_analysis']): LexicalIndicator[] | undefined {
  if (!analysis) return undefined;
  return analysis.map(item => ({
    name: item.name,
    detected: item.detected,
    description: item.description,
    severity: (item.severity as LexicalIndicator['severity']) || 'medium',
  }));
}

function mapThreatIntelligence(ti?: BackendScanResponse['threat_intelligence']): ThreatIntelligenceResult | undefined {
  if (!ti) return undefined;
  return {
    found: ti.found,
    sources: ti.sources,
    details: ti.details,
  };
}

function mapPageInspection(pi?: BackendScanResponse['page_inspection']): PageInspectionResult | undefined {
  if (!pi) return undefined;
  return {
    suspiciousForms: pi.suspicious_forms,
    brandImpersonation: pi.brand_impersonation,
    suspiciousDomPatterns: pi.suspicious_dom_patterns,
    details: pi.details,
  };
}

export function adaptScanResponse(response: BackendScanResponse): ScanResult {
  return {
    url: response.url,
    verdict: mapVerdict(response.verdict),
    riskScore: response.risk_score,
    summary: response.summary,
    lexicalAnalysis: mapLexicalAnalysis(response.lexical_analysis),
    threatIntelligence: mapThreatIntelligence(response.threat_intelligence),
    pageInspection: mapPageInspection(response.page_inspection),
    reasons: response.reasons,
    timestamp: response.timestamp,
  };
}