/**
 * ThreatShield — Real-time Browser Protection Content Script
 *
 * Displays a ThreatShield in-page protection popup/overlay:
 *   • Website URL
 *   • Risk score (1–10 scale)
 *   • Verdict: Safe / Suspicious / Phishing
 *
 * Behavior:
 *   - Risk Score ≥ Threshold (or Phishing/Suspicious): Shows prominent overlay with Block and Continue Anyway buttons.
 *   - Risk Score < Threshold (Safe): Shows Safe toast notification and auto-dismisses after 2.5 seconds.
 */
(() => {
  const STYLE_ID = "threatshield-style-v3";
  const TOAST_ID = "threatshield-toast";
  const OVERLAY_ID = "threatshield-overlay";

  // ── Style Injection ────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

      #${TOAST_ID}, #${OVERLAY_ID} {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
        all: initial;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }

      /* ── Safe Toast (Auto-dismisses in 2.5s) ──────────────── */
      #${TOAST_ID} {
        display: block !important;
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        width: 350px !important;
        background: #091a13 !important;
        border: 1px solid rgba(16,185,129,0.4) !important;
        border-left: 5px solid #10b981 !important;
        border-radius: 14px !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(16,185,129,0.15) !important;
        overflow: hidden !important;
        animation: ts-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1) !important;
      }
      .ts-toast-inner {
        padding: 14px 18px !important;
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
      }
      .ts-toast-icon { font-size: 22px !important; flex-shrink: 0 !important; }
      .ts-toast-body { flex: 1 !important; min-width: 0 !important; }
      .ts-toast-header { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 4px !important; }
      .ts-toast-title { font-weight: 700 !important; font-size: 13px !important; color: #10b981 !important; }
      .ts-toast-badge {
        background: rgba(16,185,129,0.2) !important;
        color: #34d399 !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        padding: 2px 8px !important;
        border-radius: 9999px !important;
        font-family: monospace !important;
      }
      .ts-toast-sub { font-size: 11px !important; color: rgba(255,255,255,0.6) !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .ts-toast-close {
        all: unset !important;
        cursor: pointer !important;
        color: rgba(255,255,255,0.4) !important;
        font-size: 16px !important;
        padding: 4px !important;
      }
      .ts-toast-close:hover { color: rgba(255,255,255,0.9) !important; }

      /* ── Threat Protection Overlay ────────────────────────── */
      #${OVERLAY_ID} {
        display: flex !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        background: rgba(8, 2, 2, 0.96) !important;
        backdrop-filter: blur(8px) !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        animation: ts-fade-in 0.25s ease-out !important;
        overflow-y: auto !important;
      }
      .ts-card {
        background: #110505 !important;
        border: 1px solid rgba(239, 68, 68, 0.35) !important;
        border-radius: 24px !important;
        padding: 36px !important;
        max-width: 580px !important;
        width: 100% !important;
        box-shadow: 0 20px 60px rgba(239, 68, 68, 0.25) !important;
        text-align: center !important;
      }
      .ts-card-suspicious {
        background: #1a1300 !important;
        border-color: rgba(245, 158, 11, 0.4) !important;
        box-shadow: 0 20px 60px rgba(245, 158, 11, 0.2) !important;
      }
      .ts-icon { font-size: 52px !important; margin-bottom: 14px !important; }
      .ts-title {
        font-size: 26px !important;
        font-weight: 800 !important;
        color: #ef4444 !important;
        margin-bottom: 6px !important;
        letter-spacing: -0.5px !important;
      }
      .ts-title-suspicious { color: #f59e0b !important; }
      .ts-metrics {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 12px !important;
        margin-bottom: 16px !important;
      }
      .ts-metric-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 6px 14px !important;
        border-radius: 9999px !important;
        font-size: 13px !important;
        font-weight: 700 !important;
      }
      .ts-badge-danger { background: rgba(239,68,68,0.2) !important; color: #f87171 !important; border: 1px solid rgba(239,68,68,0.3) !important; }
      .ts-badge-warning { background: rgba(245,158,11,0.2) !important; color: #fbbf24 !important; border: 1px solid rgba(245,158,11,0.3) !important; }
      .ts-badge-score { background: rgba(255,255,255,0.08) !important; color: #ffffff !important; font-family: monospace !important; border: 1px solid rgba(255,255,255,0.15) !important; }
      
      .ts-url-box {
        background: rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 10px !important;
        padding: 10px 14px !important;
        font-size: 12px !important;
        color: rgba(255,255,255,0.7) !important;
        word-break: break-all !important;
        text-align: left !important;
        margin-bottom: 20px !important;
        font-family: monospace !important;
      }
      .ts-reasons {
        text-align: left !important;
        margin-bottom: 24px !important;
        background: rgba(0,0,0,0.3) !important;
        padding: 14px !important;
        border-radius: 12px !important;
      }
      .ts-reasons-title {
        font-size: 11px !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
        color: rgba(255,255,255,0.4) !important;
        margin-bottom: 8px !important;
        font-weight: 700 !important;
      }
      .ts-reason-item {
        display: flex !important;
        align-items: flex-start !important;
        gap: 8px !important;
        font-size: 12px !important;
        color: rgba(255,255,255,0.85) !important;
        padding: 4px 0 !important;
        line-height: 1.4 !important;
      }
      .ts-actions {
        display: flex !important;
        gap: 12px !important;
        justify-content: center !important;
        flex-wrap: wrap !important;
      }
      .ts-btn {
        all: unset !important;
        cursor: pointer !important;
        padding: 12px 24px !important;
        border-radius: 10px !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        border: 1px solid !important;
        white-space: nowrap !important;
        transition: all 0.15s ease !important;
      }
      .ts-btn:hover { filter: brightness(1.15) !important; transform: translateY(-1px) !important; }
      .ts-btn-block {
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
        border-color: transparent !important;
        color: #ffffff !important;
        box-shadow: 0 4px 14px rgba(239,68,68,0.4) !important;
      }
      .ts-btn-continue {
        background: rgba(255,255,255,0.08) !important;
        border-color: rgba(255,255,255,0.2) !important;
        color: rgba(255,255,255,0.85) !important;
      }
      .ts-btn-report {
        background: rgba(99,102,241,0.15) !important;
        border-color: rgba(99,102,241,0.4) !important;
        color: #818cf8 !important;
      }

      /* ── Animations ─────────────────────────────────────── */
      @keyframes ts-slide-in {
        from { opacity: 0; transform: translateX(30px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes ts-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `;
    document.documentElement.appendChild(s);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function removeAll() {
    [TOAST_ID, OVERLAY_ID].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function openTab(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ── SAFE Toast Handler (Auto-dismisses in 2.5 seconds) ────────────────────

  function showSafeToast(payload) {
    removeAll();
    const { url, score } = payload;
    const el = document.createElement("div");
    el.id = TOAST_ID;
    el.innerHTML = `
      <div class="ts-toast-inner">
        <span class="ts-toast-icon">🛡️</span>
        <div class="ts-toast-body">
          <div class="ts-toast-header">
            <span class="ts-toast-title">ThreatShield Protection</span>
            <span class="ts-toast-badge">Score: ${score}/10</span>
          </div>
          <div class="ts-toast-sub">Verdict: Safe · ${esc(url)}</div>
        </div>
        <button class="ts-toast-close" id="ts-toast-x">✕</button>
      </div>
    `;
    (document.body || document.documentElement).appendChild(el);
    el.querySelector("#ts-toast-x").addEventListener("click", () => el.remove());

    // Auto-dismiss after 2.5 seconds as specified in requirements
    setTimeout(() => {
      if (el && el.parentNode) {
        el.remove();
      }
    }, 2500);
  }

  // ── Protection Overlay Handler (Strict Block for Red / Confirmation for Amber) ─────────────

  function showProtectionOverlay(payload) {
    removeAll();
    const { url, verdict, score, threshold, reasons, reportUrl } = payload;

    const isPhishing = verdict.toLowerCase() === "phishing" || verdict.toLowerCase() === "dangerous";
    const titleText = isPhishing ? "Strict Security Block: Malicious Website" : "Suspicious Website Warning";
    const icon = isPhishing ? "🚨" : "⚠️";
    const badgeClass = isPhishing ? "ts-badge-danger" : "ts-badge-warning";
    const cardClass = isPhishing ? "ts-card" : "ts-card ts-card-suspicious";
    const titleClass = isPhishing ? "ts-title" : "ts-title ts-title-suspicious";

    const reasonsListHtml = (reasons && reasons.length > 0 ? reasons : ["Potential phishing pattern or brand impersonation detected."])
      .map(r => `<div class="ts-reason-item"><span>•</span><span>${esc(r)}</span></div>`)
      .join("");

    // RED (Dangerous/Phishing): STRICT BLOCK — No continue button allowed!
    // AMBER (Suspicious): CONFIRMATION PROMPT — Requires explicit user confirmation to proceed.
    const actionsHtml = isPhishing
      ? `
        <div class="ts-actions">
          <button class="ts-btn ts-btn-block" id="ts-btn-block" style="width: 100%;">⛔ Access Denied — Return to Safety</button>
          <button class="ts-btn ts-btn-report" id="ts-btn-report">Threat Details</button>
        </div>
        <p style="color: rgba(239,68,68,0.8); font-size: 11px; margin-top: 12px; text-align: center;">
          Access to this website is strictly restricted by your organization security policy.
        </p>
      `
      : `
        <div class="ts-actions">
          <button class="ts-btn ts-btn-block" id="ts-btn-block">🛡️ Leave Site (Recommended)</button>
          <button class="ts-btn ts-btn-continue" id="ts-btn-continue">I Understand, Proceed</button>
          <button class="ts-btn ts-btn-report" id="ts-btn-report">Details</button>
        </div>
        <p style="color: rgba(245,158,11,0.8); font-size: 11px; margin-top: 12px; text-align: center;">
          Exercise caution before entering any credentials or downloading files.
        </p>
      `;

    const el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.innerHTML = `
      <div class="${cardClass}">
        <div class="ts-icon">${icon}</div>
        <div class="${titleClass}">${titleText}</div>
        
        <div class="ts-metrics">
          <span class="ts-metric-badge ${badgeClass}">Verdict: ${esc(verdict)}</span>
          <span class="ts-metric-badge ts-badge-score">Risk Score: ${score} / 10</span>
        </div>

        <div class="ts-url-box">URL: ${esc(url)}</div>

        <div class="ts-reasons">
          <div class="ts-reasons-title">Security Policy & Threat Intelligence</div>
          ${reasonsListHtml}
        </div>

        ${actionsHtml}
      </div>
    `;
    (document.body || document.documentElement).appendChild(el);

    // Block action: Navigates back in history or redirects to blank
    el.querySelector("#ts-btn-block")?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "about:blank";
      }
      el.remove();
    });

    // Continue action (only present for AMBER/Suspicious confirmation prompt)
    el.querySelector("#ts-btn-continue")?.addEventListener("click", () => {
      el.remove();
    });

    // Full Report action
    el.querySelector("#ts-btn-report")?.addEventListener("click", () => {
      openTab(reportUrl);
    });
  }

  // ── Message Listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GATEKEEPER_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GATEKEEPER_RESULT") {
      injectStyles();
      const payload = message.payload;
      const score = payload?.score || 1;
      const threshold = payload?.threshold || 7;
      const verdict = (payload?.verdict || "Safe").toLowerCase();

      // If risk score ≥ configured threshold or verdict is Phishing/Suspicious, show Block + Continue overlay
      if (score >= threshold || verdict === "phishing" || verdict === "dangerous" || verdict === "suspicious") {
        showProtectionOverlay(payload);
      } else {
        // Below threshold: Show Safe toast and auto-dismiss after 2.5 seconds
        showSafeToast(payload);
      }

      sendResponse({ ok: true });
      return;
    }
  });
})();
