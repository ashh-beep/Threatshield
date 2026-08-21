import type { ScanRequest, ScanResult, Verdict } from '../types/scanner';

const MOCK_DELAY = 2000;

function createMockResult(url: string, verdict: Verdict): ScanResult {
  const baseResult: ScanResult = {
    url,
    verdict,
    riskScore: 0,
    summary: '',
    lexicalAnalysis: [],
    threatIntelligence: { found: false },
    pageInspection: {},
    reasons: [],
    timestamp: new Date().toISOString(),
  };

  switch (verdict) {
    case 'safe':
      return {
        ...baseResult,
        riskScore: 15,
        summary: 'This URL appears to be safe. No threats detected.',
        lexicalAnalysis: [
          { name: 'IP Address Usage', detected: false, description: 'URL does not use an IP address instead of a domain name', severity: 'low' },
          { name: 'Digit Substitution', detected: false, description: 'No suspicious digit substitutions detected (e.g., g00gle.com)', severity: 'low' },
          { name: 'URL Length', detected: false, description: 'URL length is within normal range', severity: 'low' },
          { name: 'Subdomain Depth', detected: false, description: 'Normal subdomain structure', severity: 'low' },
          { name: 'HTTPS Misuse', detected: false, description: 'Proper HTTPS implementation', severity: 'low' },
          { name: 'Special Characters', detected: false, description: 'No excessive special characters', severity: 'low' },
        ],
        threatIntelligence: { found: false, details: 'No matches in threat intelligence databases' },
        pageInspection: { suspiciousForms: false, brandImpersonation: false, suspiciousDomPatterns: false, details: 'No suspicious page behavior detected' },
        reasons: ['Clean lexical structure', 'No threat intelligence matches', 'Normal page behavior'],
      };

    case 'suspicious':
      return {
        ...baseResult,
        riskScore: 55,
        summary: 'This URL shows suspicious characteristics. Exercise caution.',
        lexicalAnalysis: [
          { name: 'IP Address Usage', detected: false, description: 'URL does not use an IP address instead of a domain name', severity: 'low' },
          { name: 'Digit Substitution', detected: true, description: 'Suspicious digit substitution detected (e.g., paypa1.com)', severity: 'medium' },
          { name: 'URL Length', detected: true, description: 'URL is unusually long, possibly to hide the true domain', severity: 'medium' },
          { name: 'Subdomain Depth', detected: true, description: 'Excessive subdomain nesting detected', severity: 'medium' },
          { name: 'HTTPS Misuse', detected: false, description: 'HTTPS is properly implemented', severity: 'low' },
          { name: 'Special Characters', detected: true, description: 'Excessive special characters in URL path', severity: 'low' },
        ],
        threatIntelligence: { found: false, details: 'No known threat intelligence matches' },
        pageInspection: { suspiciousForms: true, brandImpersonation: true, suspiciousDomPatterns: false, details: 'Suspicious form action detected; possible brand impersonation' },
        reasons: ['Digit substitution in domain', 'Excessive URL length', 'Deep subdomain nesting', 'Suspicious form behavior', 'Potential brand impersonation'],
      };

    case 'dangerous':
      return {
        ...baseResult,
        riskScore: 92,
        summary: 'DANGEROUS: This URL is confirmed as a phishing/malicious site. Do not visit.',
        lexicalAnalysis: [
          { name: 'IP Address Usage', detected: true, description: 'URL uses IP address instead of domain name', severity: 'high' },
          { name: 'Digit Substitution', detected: true, description: 'Obvious digit substitution (e.g., g00gle.com)', severity: 'high' },
          { name: 'URL Length', detected: true, description: 'Extremely long URL to obscure malicious destination', severity: 'high' },
          { name: 'Subdomain Depth', detected: true, description: 'Excessive subdomain nesting to mimic legitimate domains', severity: 'high' },
          { name: 'HTTPS Misuse', detected: true, description: 'Invalid or self-signed certificate', severity: 'high' },
          { name: 'Special Characters', detected: true, description: 'Heavy use of special characters to evade detection', severity: 'medium' },
        ],
        threatIntelligence: { found: true, sources: ['PhishTank', 'OpenPhish', 'Google Safe Browsing'], details: 'Listed in multiple threat intelligence feeds' },
        pageInspection: { suspiciousForms: true, brandImpersonation: true, suspiciousDomPatterns: true, details: 'Credential harvesting form detected; mimics Microsoft login page; obfuscated JavaScript' },
        reasons: [
          'Confirmed phishing site in threat intelligence databases',
          'IP address used instead of domain',
          'Digit substitution mimicking legitimate brand',
          'Credential harvesting form detected',
          'Brand impersonation: Microsoft',
          'Obfuscated malicious JavaScript',
          'Invalid SSL certificate',
        ],
      };

    default:
      return baseResult;
  }
}

export const mockScannerService = {
  async scanUrl(request: ScanRequest): Promise<ScanResult> {
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    
    const url = request.url.toLowerCase();
    let verdict: Verdict = 'safe';
    
    if (url.includes('phishing') || url.includes('malicious') || url.includes('dangerous') || url.includes('fake') || url.includes('scam')) {
      verdict = 'dangerous';
    } else if (url.includes('suspicious') || url.includes('weird') || url.includes('test') || url.length > 80) {
      verdict = 'suspicious';
    }
    
    return createMockResult(request.url, verdict);
  },

  async healthCheck(): Promise<{ status: string }> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { status: 'ok' };
  },
};