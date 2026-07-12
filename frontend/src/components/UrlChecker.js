import React, { useState, useEffect, useRef } from "react";

const API_BASE = "http://localhost:5001";

// ── Utility ───────────────────────────────────────────────────────────────────

function verdictClass(verdict) {
  if (!verdict) return "";
  const v = verdict.toLowerCase();
  if (v === "safe") return "safe";
  if (v === "dangerous") return "dangerous";
  return "suspicious";
}

function verdictIcon(verdict) {
  if (!verdict) return "⏳";
  const v = verdict.toLowerCase();
  if (v === "safe") return "✅";
  if (v === "dangerous") return "🚨";
  return "⚠️";
}

function verdictDesc(verdict, inOpenPhish) {
  if (!verdict) return "";
  const v = verdict.toLowerCase();
  if (v === "safe")
    return "No phishing indicators found. This URL appears legitimate based on structural analysis and threat intelligence.";
  if (v === "dangerous")
    return inOpenPhish
      ? "This URL is listed in the OpenPhish live threat database as a confirmed phishing site."
      : "Multiple high-confidence phishing indicators detected. Do NOT visit this site.";
  return "Suspicious structural patterns detected. Proceed with extreme caution and do not enter any credentials.";
}

function scoreColor(verdict) {
  const v = (verdict || "").toLowerCase();
  if (v === "safe") return "var(--accent-green)";
  if (v === "dangerous") return "var(--accent-red)";
  return "var(--accent-yellow)";
}

// ── StageCard ─────────────────────────────────────────────────────────────────

function StageCard({ num, title, subtitle, status, statusLabel, statusColor, children, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);

  const cardClass = `stage-card ${
    status === "running" ? "running" :
    statusColor === "green" ? "done-safe" :
    statusColor === "red" ? "done-phishing" :
    statusColor === "yellow" ? "done-suspicious" : ""
  }`;

  return (
    <div className={cardClass}>
      <div className="stage-header" onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={e => e.key === "Enter" && setOpen(o => !o)}>
        <div className="stage-num">{num}</div>
        <div style={{ flex: 1 }}>
          <div className="stage-title">{title}</div>
          <div className="stage-subtitle">{subtitle}</div>
        </div>
        <div className="stage-status">
          <div className={`stage-status-dot ${statusColor || "grey"}`} />
          <span style={{ color: statusColor === "green" ? "var(--accent-green)"
            : statusColor === "red" ? "var(--accent-red)"
            : statusColor === "yellow" ? "var(--accent-yellow)"
            : statusColor === "blue" ? "var(--accent-blue)"
            : "var(--text-muted)" }}>
            {statusLabel}
          </span>
        </div>
        <span className={`stage-chevron ${open ? "open" : ""}`}>▼</span>
      </div>
      {open && <div className="stage-body">{children}</div>}
    </div>
  );
}

// ── ReasonItem ────────────────────────────────────────────────────────────────

function ReasonItem({ text, type = "warn" }) {
  const icon = type === "ok" ? "✓" : type === "info" ? "ℹ" : "⚠";
  const color = type === "ok" ? "var(--accent-green)"
    : type === "info" ? "var(--accent-blue)"
    : "var(--accent-yellow)";
  return (
    <div className="reason-item">
      <span className="reason-icon" style={{ color }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ── PageInspectResult ─────────────────────────────────────────────────────────

function PageInspectResult({ data }) {
  if (!data) return null;

  const verdict = data.verdict || "unknown";
  const verdictBadgeClass = verdict === "phishing" ? "badge-red"
    : verdict === "suspicious" ? "badge-yellow"
    : verdict === "clean" ? "badge-green"
    : "badge-blue";

  const findings = [];

  if (data.brand_impersonation && data.impersonated_brand) {
    findings.push({
      icon: "🎭",
      text: `Brand impersonation detected — page content mimics "${data.impersonated_brand}" but the domain does not match`,
      badge: "PHISHING", badgeClass: "badge-red"
    });
  }
  if (data.suspicious_forms) {
    const externalForms = (data.forms || []).filter(f => f.external);
    findings.push({
      icon: "📤",
      text: `${externalForms.length} form(s) submit data to an external domain (${externalForms.map(f => f.action?.substring(0, 60)).join(", ")})`,
      badge: "CREDENTIAL THEFT", badgeClass: "badge-red"
    });
  }
  if (data.has_password_field && data.suspicious_forms) {
    findings.push({
      icon: "🔑",
      text: "Password field detected paired with external form action — classic credential harvesting pattern",
      badge: "HIGH RISK", badgeClass: "badge-red"
    });
  }
  (data.dom_flags || []).forEach(flag => {
    findings.push({
      icon: "🕵️",
      text: flag,
      badge: "DOM FLAG", badgeClass: "badge-yellow"
    });
  });

  if (findings.length === 0) {
    findings.push({
      icon: "✅",
      text: "No suspicious page content, hidden elements, or external form actions detected",
      badge: "CLEAN", badgeClass: "badge-green"
    });
  }

  return (
    <div className="page-inspect-card">
      <div className="page-inspect-header">
        <span>🔍</span>
        <span style={{ flex: 1 }}>Page Inspection Results</span>
        <span className={`inspect-badge ${verdictBadgeClass}`}>{verdict.toUpperCase()}</span>
        {data.latency_ms && (
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
            {data.latency_ms}ms
          </span>
        )}
      </div>
      <div className="page-inspect-body">
        {data.page_title && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10 }}>
            Page title: <span style={{ color: "var(--text-secondary)" }}>"{data.page_title}"</span>
          </div>
        )}
        {findings.map((f, i) => (
          <div className="inspect-finding" key={i}>
            <span>{f.icon}</span>
            <span style={{ flex: 1 }}>{f.text}</span>
            <span className={`inspect-badge ${f.badgeClass}`}>{f.badge}</span>
          </div>
        ))}
        {data.error && (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
            Note: {data.error}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main UrlChecker ───────────────────────────────────────────────────────────

export default function UrlChecker() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [pageInspect, setPageInspect] = useState(null);
  const [pageInspectStatus, setPageInspectStatus] = useState(null); // "pending" | "done"

  const pollRef = useRef(null);

  // Auto-fill from query string (for extension "open report" links)
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const u = qs.get("url");
    if (u) {
      setUrl(u);
      setTimeout(() => runCheck(u), 100);
    }
  }, []); // eslint-disable-line

  // Poll for page inspection result
  useEffect(() => {
    if (!result || !result.url) return;
    if (pageInspectStatus === "done") return;

    // Start polling
    const checkOnce = async () => {
      try {
        const r = await fetch(
          `${API_BASE}/api/page_inspect_result?url=${encodeURIComponent(result.url)}`
        );
        const d = await r.json();
        if (d.status === "done") {
          setPageInspect(d.result);
          setPageInspectStatus("done");
          clearInterval(pollRef.current);
        }
      } catch (_) {}
    };

    pollRef.current = setInterval(checkOnce, 2000);
    checkOnce(); // immediate first check

    return () => clearInterval(pollRef.current);
  }, [result, pageInspectStatus]);

  const runCheck = async (overrideUrl) => {
    const u = (overrideUrl ?? url).trim();
    if (!u) return;

    setLoading(true);
    setResult(null);
    setError("");
    setPageInspect(null);
    setPageInspectStatus("pending");
    clearInterval(pollRef.current);

    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API ${res.status}: ${txt}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e.message || "Failed to connect to backend. Is it running on port 5001?");
    } finally {
      setLoading(false);
    }
  };

  // ── Ensemble Logic ────────────────────────────────────────────────────────
  let ensembleRiskScore = result?.risk_score || 0;
  let ensembleVerdict = result?.verdict || "Unknown";
  
  if (pageInspectStatus === "done" && pageInspect) {
    const pageScore = pageInspect.risk_score || 1;
    if (pageScore > ensembleRiskScore) {
      ensembleRiskScore = pageScore;
    }
    
    // Page inspect can override the verdict to be more severe
    if (pageInspect.verdict === "phishing") {
      ensembleVerdict = "Dangerous";
    } else if (pageInspect.verdict === "suspicious" && ensembleVerdict === "Safe") {
      ensembleVerdict = "Suspicious";
    }
  }

  const vClass = result ? verdictClass(ensembleVerdict) : "";
  const inOpenPhish = result?.stages?.threat_api?.in_openphish || false;

  // Lexical stage status
  const lexStage = result?.stages?.lexical;
  const lexStatusColor = !result ? "grey"
    : lexStage?.verdict === "phishing" ? "red"
    : "green";
  const lexStatusLabel = !result ? "Waiting"
    : lexStage ? `${Math.round(lexStage.phishing_probability * 100)}% phish probability`
    : "Error";

  // Threat stage status
  const threatStage = result?.stages?.threat_api;
  const threatStatusColor = !result ? "grey"
    : !threatStage?.checked ? "grey"
    : threatStage?.in_openphish ? "red"
    : "green";
  const threatStatusLabel = !result ? "Waiting"
    : !threatStage?.checked ? "Unavailable"
    : threatStage?.in_openphish ? "Listed in OpenPhish feed"
    : `Not in feed (${(threatStage?.feed_size || 0).toLocaleString()} entries)`;

  // Page inspect stage status
  const pageStatusColor = !result ? "grey"
    : pageInspectStatus === "pending" ? "blue"
    : pageInspect?.verdict === "phishing" ? "red"
    : pageInspect?.verdict === "suspicious" ? "yellow"
    : pageInspect?.verdict === "clean" ? "green"
    : "grey";
  const pageStatusLabel = !result ? "Waiting"
    : pageInspectStatus === "pending" ? "Analyzing page…"
    : pageInspect ? (pageInspect.verdict || "done").charAt(0).toUpperCase() + (pageInspect.verdict || "done").slice(1)
    : "Done";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="input-card" style={{ maxWidth: 760, width: "100%" }}>
        <span className="input-icon">🔗</span>
        <input
          id="url-input"
          className="url-input"
          placeholder="Paste any URL to scan (e.g. https://suspicious-login.com/paypal)"
          value={url}
          spellCheck={false}
          autoComplete="off"
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !loading && runCheck()}
        />
        <button
          id="scan-btn"
          className="scan-btn"
          onClick={() => runCheck()}
          disabled={loading || !url.trim()}
        >
          {loading ? <><span className="scan-btn-spinner" /> Scanning…</> : "Scan URL →"}
        </button>
      </div>

      {/* ── Loading bar ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="loading-bar-wrap" style={{ maxWidth: 760, width: "100%" }}>
          <div className="loading-bar-fill" />
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && <div className="error-msg">⚠ {error}</div>}

      {/* ── Verdict Banner ────────────────────────────────────────────────── */}
      {result && (
        <div className={`verdict-banner ${vClass}`}>
          <div className="verdict-icon">{verdictIcon(ensembleVerdict)}</div>
          <div className="verdict-info">
            <div className="verdict-label">{ensembleVerdict}</div>
            <div className="verdict-desc">{verdictDesc(ensembleVerdict, inOpenPhish)}</div>
          </div>
          <div className="verdict-score-wrap">
            <div className="verdict-score-num" style={{ color: scoreColor(ensembleVerdict) }}>
              {ensembleRiskScore}<span style={{ fontSize: "1rem", opacity: 0.5 }}>/10</span>
            </div>
            <div className="verdict-score-label">Risk Score</div>
            <div className="score-bar-wrap">
              <div
                className="score-bar-fill"
                style={{
                  width: `${ensembleRiskScore * 10}%`,
                  background: scoreColor(ensembleVerdict)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Pipeline stages ───────────────────────────────────────────────── */}
      {result && (
        <div className="pipeline-wrapper">

          {/* Stage 1 — Lexical */}
          <StageCard
            num="1"
            title="Lexical Analysis"
            subtitle="URL structure inspection via trained Random Forest model"
            status={lexStage ? "done" : "waiting"}
            statusLabel={lexStatusLabel}
            statusColor={lexStatusColor}
            defaultOpen={true}
          >
            <div className="reasons-list" style={{ marginTop: 12 }}>
              {(result.reasons || []).map((r, i) => (
                <ReasonItem
                  key={i}
                  text={r}
                  type={r.startsWith("No major") ? "ok" : "warn"}
                />
              ))}
            </div>
            {lexStage && (
              <div className="stage-latency">
                Completed in {lexStage.latency_ms}ms · phishing probability: {Math.round(lexStage.phishing_probability * 100)}%
              </div>
            )}
          </StageCard>

          {/* Stage 2 — Threat Intelligence */}
          <StageCard
            num="2"
            title="Threat Intelligence API"
            subtitle="Live OpenPhish feed lookup (updated every 6 hours)"
            status={threatStage ? "done" : "waiting"}
            statusLabel={threatStatusLabel}
            statusColor={threatStatusColor}
            defaultOpen={threatStage?.in_openphish}
          >
            {threatStage && (
              <div style={{ marginTop: 12 }}>
                <ReasonItem
                  type={threatStage.in_openphish ? "warn" : "ok"}
                  text={
                    threatStage.in_openphish
                      ? "⚠ This URL is confirmed in the OpenPhish phishing database"
                      : `URL not found in the OpenPhish feed (${(threatStage.feed_size || 0).toLocaleString()} verified phishing URLs checked)`
                  }
                />
                {threatStage.error && (
                  <ReasonItem type="info" text={`Feed status: ${threatStage.error}`} />
                )}
                <div className="stage-latency">
                  Completed in {threatStage.latency_ms}ms
                  {threatStage.cache_age_s !== undefined && ` · feed cached ${Math.round(threatStage.cache_age_s / 60)}m ago`}
                </div>
              </div>
            )}
          </StageCard>

          {/* Stage 3 — Page Inspection */}
          <StageCard
            num="3"
            title="Page Content Inspection"
            subtitle="DOM analysis, form inspection & brand impersonation detection (async)"
            status={pageInspectStatus === "pending" ? "running" : "done"}
            statusLabel={pageStatusLabel}
            statusColor={pageStatusColor}
            defaultOpen={pageInspect?.verdict !== "clean"}
          >
            {pageInspectStatus === "pending" && !pageInspect && (
              <div style={{ padding: "14px 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                🔄 Page is being fetched and analyzed in the background…
              </div>
            )}
            {pageInspect && (
              <PageInspectResult data={pageInspect} />
            )}
          </StageCard>
        </div>
      )}
    </div>
  );
}
