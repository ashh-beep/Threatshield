import { Button } from '@components/ui/Button';
import { Card, CardContent } from '@components/ui/Card';

export function HomePage({ onNavigate }: { onNavigate: (section: string) => void }) {
  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      title: 'Comprehensive URL Analysis',
      description: 'Deep lexical analysis examining URL structure, subdomain patterns, character substitutions, and encoding anomalies that indicate phishing attempts.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Real-time Threat Intelligence',
      description: 'Integration with multiple threat intelligence feeds including PhishTank, OpenPhish, Google Safe Browsing, and custom blocklists for up-to-date detection.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Dynamic Page Inspection',
      description: 'Headless browser analysis detecting credential harvesting forms, brand impersonation, suspicious scripts, and DOM manipulation techniques.',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: 'Transparent Explanations',
      description: 'Detailed breakdown of why a URL was flagged, showing specific indicators, risk factors, and evidence so users understand the verdict.',
    },
  ];

  const howItWorks = [
    { step: '01', title: 'Enter URL', description: 'Paste any URL into the scanner. We accept full URLs or domain names.' },
    { step: '02', title: 'Multi-layer Analysis', description: 'Our engine performs lexical analysis, threat intelligence lookup, and dynamic page inspection.' },
    { step: '03', title: 'Get Results', description: 'Receive a clear verdict (Safe, Suspicious, or Dangerous) with a risk score and detailed explanation.' },
    { step: '04', title: 'Take Action', description: 'Make informed decisions with full context. View detailed analysis or report false positives.' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <section id="home" className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden" aria-labelledby="hero-heading">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-medium mb-6" aria-hidden="true">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span>New: Real-time page inspection now available</span>
            </div>
            <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-6">
              Advanced URL Security{' '}
              <span className="text-indigo-600 dark:text-indigo-400">Scanner</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Detect phishing, malware, and suspicious links before you click. 
              Powered by multi-layer analysis: lexical inspection, threat intelligence, and dynamic page analysis.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" variant="primary" className="min-w-[200px]" onClick={() => onNavigate('home')}>
                Start Scanning
              </Button>
              <Button size="lg" variant="outline" className="min-w-[200px]" onClick={() => onNavigate('how-it-works')}>
                How It Works
              </Button>
            </div>
          </div>

          <div className="relative" aria-hidden="true">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-4 max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-4 px-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 font-mono text-sm text-gray-600 dark:text-gray-400">
                  https://suspicious-paypa1-login.com/verify/account
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">Dangerous</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Verdict</div>
                </div>
                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">92%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Risk Score</div>
                </div>
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">6</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Indicators</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8" aria-labelledby="how-it-works-heading">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Four simple steps to comprehensive URL security analysis
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, index) => (
              <Card key={index} variant="outlined" className="border-gray-200 dark:border-gray-700 relative">
                <CardContent className="pt-0">
                  <div className="absolute -top-3 left-6 w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">
                    {step.step}
                  </div>
                  <div className="pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{step.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{step.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="detection" className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900" aria-labelledby="detection-heading">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 id="detection-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Detection Methods
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Three-layer analysis for comprehensive threat detection
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} variant="outlined" className="border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                <CardContent className="pt-0 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="py-20 px-4 sm:px-6 lg:px-8" aria-labelledby="security-heading">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 id="security-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Security & Privacy
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Built with security-first principles
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: 'No Data Storage',
                description: 'Scanned URLs are processed in real-time and never stored in our databases. Your privacy is paramount.',
              },
              {
                title: 'Encrypted Communication',
                description: 'All API communication uses TLS 1.3 encryption. No sensitive data is transmitted in plaintext.',
              },
              {
                title: 'Open Architecture',
                description: 'Detection methodology is transparent. Security researchers can audit and verify our approach.',
              },
            ].map((item, index) => (
              <Card key={index} variant="outlined" className="border-gray-200 dark:border-gray-700">
                <CardContent className="pt-0 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900" aria-labelledby="about-heading">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 id="about-heading" className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              About Gatekeeper
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Our mission is to make the web safer for everyone
            </p>
          </div>

          <div className="max-w-3xl mx-auto text-center">
            <div className="prose dark:prose-invert mx-auto text-left">
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Gatekeeper was built to address the growing sophistication of phishing attacks and malicious URLs.
                Traditional URL filtering relies on blocklists that are always one step behind attackers.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Our approach combines static lexical analysis — examining URL structure for telltale signs of phishing
                like digit substitution, excessive subdomains, and suspicious character patterns — with real-time threat
                intelligence feeds and dynamic page inspection that actually visits and analyzes the target page.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                We believe security tools should be transparent. When Gatekeeper flags a URL, it shows you exactly why:
                the specific indicators detected, the threat intelligence sources consulted, and the page behaviors observed.
                This helps users make informed decisions and builds trust in the system.
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Whether you're a security professional investigating suspicious links or an everyday user checking
                a link before clicking, Gatekeeper provides the analysis you need to stay safe online.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}