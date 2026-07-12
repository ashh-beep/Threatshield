import React from "react";
import UrlChecker from "./components/UrlChecker";

function NavBar() {
  return (
    <nav className="navbar">
      <a href="/" className="navbar-brand">
        <div className="navbar-logo-placeholder">G</div>
        <span className="navbar-name">Gatekeeper</span>
      </a>
      <div className="navbar-spacer" />
      <div className="navbar-links">
        <a href="#scan" className="active">Scan URL</a>
        <a href="#how">How it works</a>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <>
      <div className="bg-mesh" />
      <NavBar />
      <main className="main-content" id="scan">
        {/* Hero */}
        <div className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Real-time Phishing Detection
          </div>
          <h1 className="hero-title">
            Detect Phishing Links<br />
            <span className="hero-title-accent">Before They Get You.</span>
          </h1>
          <p className="hero-subtitle">
            Gatekeeper analyzes URLs through three layers — lexical heuristics,
            live threat intelligence, and page content inspection — in under one second.
          </p>
        </div>

        {/* URL Checker (all logic inside) */}
        <UrlChecker />

        {/* How it works */}
        <section className="how-section" id="how">
          <div className="how-title">Three-Stage Detection Pipeline</div>
          <div className="how-grid">
            <div className="how-card">
              <div className="how-card-icon">🔬</div>
              <div className="how-card-title">Lexical Analysis</div>
              <div className="how-card-desc">
                9 structural URL features analyzed by a trained Random Forest model.
                Catches zero-day phishing in &lt;50 ms.
              </div>
            </div>
            <div className="how-card">
              <div className="how-card-icon">🛡️</div>
              <div className="how-card-title">Threat Intelligence</div>
              <div className="how-card-desc">
                URL checked against the live OpenPhish feed of verified phishing domains
                updated every 6 hours.
              </div>
            </div>
            <div className="how-card">
              <div className="how-card-icon">🔍</div>
              <div className="how-card-title">Page Inspection</div>
              <div className="how-card-desc">
                DOM analysis detects hidden iframes, external form actions, brand
                impersonation, and obfuscated JavaScript.
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
