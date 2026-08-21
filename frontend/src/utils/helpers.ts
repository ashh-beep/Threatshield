export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!trimmed.match(/^https?:\/\//i)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function getVerdictColor(verdict: 'safe' | 'suspicious' | 'dangerous'): string {
  switch (verdict) {
    case 'safe':
      return '#10b981';
    case 'suspicious':
      return '#f59e0b';
    case 'dangerous':
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

export function getVerdictLabel(verdict: 'safe' | 'suspicious' | 'dangerous'): string {
  switch (verdict) {
    case 'safe':
      return 'Safe';
    case 'suspicious':
      return 'Suspicious';
    case 'dangerous':
      return 'Dangerous';
    default:
      return 'Unknown';
  }
}

export function formatRiskScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}