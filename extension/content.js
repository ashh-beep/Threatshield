/**
 * ThreatShield — Real-time Browser Protection Content Script
 *
 * Pre-load page blocking & threat enforcement with pastel design system:
 *   • Intercepts navigation at document_start (hides page until backend evaluation)
 *   • Safe (Green): Unhides page instantly + shows 2.5s soft pastel toast
 *   • Suspicious (Amber) / Dangerous (Red): Keeps page hidden behind pastel protection screen
 *   • Provides explicit user choices: "Go Back to Safety" or "Proceed Anyway" (unhides page)
 *   • All risk scores standardized to 0–100% percentages
 */
(() => {
  const STYLE_ID = "threatshield-style-v4";
  const TOAST_ID = "threatshield-toast";
  const OVERLAY_ID = "threatshield-overlay";

  // ── Pre-load Page Interception ─────────────────────────────────────────────
  let isPageBlocked = true;

  function applyPageHide() {
    if (isPageBlocked && document.documentElement) {
      document.documentElement.style.visibility = "hidden";
    }
  }

  function unhidePage() {
    isPageBlocked = false;
    if (document.documentElement) {
      document.documentElement.style.visibility = "";
    }
  }

  // Hide page immediately on script load
  applyPageHide();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (isPageBlocked) applyPageHide();
    });
  }

  // Safety fallback: if no message is received in 4 seconds, unhide page to prevent broken navigation
  const fallbackTimer = setTimeout(() => {
    if (isPageBlocked) {
      unhidePage();
    }
  }, 4000);

  // ── Pastel Style System Injection ──────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');

      #${TOAST_ID}, #${OVERLAY_ID} {
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
        -webkit-font-smoothing: antialiased !important;
        box-sizing: border-box !important;
        all: initial !important;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
      }

      /* ── Soft Pastel Safe Toast (Auto-dismisses in 2.5s) ── */
      #${TOAST_ID} {
        display: block !important;
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        width: 360px !important;
        background: #f0fdf4 !important;
        border: 1px solid #bbf7d0 !important;
        border-radius: 20px !important;
        box-shadow: 0 12px 32px rgba(16, 185, 129, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04) !important;
        overflow: hidden !important;
        animation: ts-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
        visibility: visible !important;
      }
      .ts-toast-inner {
        padding: 14px 18px !important;
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
      }
      .ts-toast-icon { font-size: 24px !important; flex-shrink: 0 !important; }
      .ts-toast-body { flex: 1 !important; min-width: 0 !important; }
      .ts-toast-header { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 4px !important; }
      .ts-toast-title { font-weight: 700 !important; font-size: 13px !important; color: #166534 !important; }
      .ts-toast-badge {
        background: #dcfce7 !important;
        color: #15803d !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        padding: 3px 10px !important;
        border-radius: 9999px !important;
        font-family: 'JetBrains Mono', monospace !important;
      }
      .ts-toast-sub { font-size: 11px !important; color: #374151 !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
      .ts-toast-close {
        all: unset !important;
        cursor: pointer !important;
        color: #9ca3af !important;
        font-size: 16px !important;
        padding: 4px !important;
        border-radius: 50% !important;
      }
      .ts-toast-close:hover { color: #374151 !important; background: #e5e7eb !important; }

      /* ── Pastel Threat Protection Overlay (Red / Amber) ── */
      #${OVERLAY_ID} {
        display: flex !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        background: rgba(15, 23, 42, 0.75) !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        animation: ts-fade-in 0.25s ease-out !important;
        overflow-y: auto !important;
        visibility: visible !important;
      }

      /* Red / Dangerous Pastel Card */
      .ts-card-danger {
        background: #fef2f2 !important;
        border: 1px solid #fecaca !important;
        border-radius: 28px !important;
        padding: 38px !important;
        max-width: 540px !important;
        width: 100% !important;
        box-shadow: 0 24px 64px rgba(220, 38, 38, 0.15), 0 4px 16px rgba(0, 0, 0, 0.06) !important;
        text-align: center !important;
      }

      /* Amber / Suspicious Pastel Card */
      .ts-card-warning {
        background: #fffbeb !important;
        border: 1px solid #fde68a !important;
        border-radius: 28px !important;
        padding: 38px !important;
        max-width: 540px !important;
        width: 100% !important;
        box-shadow: 0 24px 64px rgba(217, 119, 6, 0.15), 0 4px 16px rgba(0, 0, 0, 0.06) !important;
        text-align: center !important;
      }

      .ts-icon { font-size: 56px !important; margin-bottom: 16px !important; line-height: 1 !important; }
      
      .ts-title-danger {
        font-size: 24px !important;
        font-weight: 800 !important;
        color: #991b1b !important;
        margin-bottom: 8px !important;
        letter-spacing: -0.4px !important;
      }

      .ts-title-warning {
        font-size: 24px !important;
        font-weight: 800 !important;
        color: #92400e !important;
        margin-bottom: 8px !important;
        letter-spacing: -0.4px !important;
      }

      .ts-metrics {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        margin-bottom: 20px !important;
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
      .ts-badge-danger { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fca5a5 !important; }
      .ts-badge-warning { background: #fef3c7 !important; color: #92400e !important; border: 1px solid #fcd34d !important; }
      .ts-badge-score { background: #ffffff !important; color: #1e293b !important; font-family: 'JetBrains Mono', monospace !important; border: 1px solid #e2e8f0 !important; }
      
      .ts-url-box {
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 14px !important;
        padding: 12px 16px !important;
        font-size: 13px !important;
        color: #475569 !important;
        word-break: break-all !important;
        text-align: left !important;
        margin-bottom: 20px !important;
        font-family: 'JetBrains Mono', monospace !important;
      }
      .ts-reasons {
        text-align: left !important;
        margin-bottom: 24px !important;
        background: rgba(255, 255, 255, 0.7) !important;
        border: 1px solid rgba(0, 0, 0, 0.05) !important;
        padding: 16px !important;
        border-radius: 16px !important;
      }
      .ts-reasons-title {
        font-size: 11px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.8px !important;
        color: #64748b !important;
        margin-bottom: 8px !important;
        font-weight: 700 !important;
      }
      .ts-reason-item {
        display: flex !important;
        align-items: flex-start !important;
        gap: 8px !important;
        font-size: 13px !important;
        color: #1e293b !important;
        padding: 4px 0 !important;
        line-height: 1.45 !important;
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
        padding: 14px 24px !important;
        border-radius: 16px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      .ts-btn:hover { transform: translateY(-2px) !important; }
      
      .ts-btn-goback-danger {
        background: #dc2626 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3) !important;
      }
      .ts-btn-goback-danger:hover { background: #b91c1c !important; }

      .ts-btn-goback-warning {
        background: #d97706 !important;
        color: #ffffff !important;
        box-shadow: 0 4px 14px rgba(217, 119, 6, 0.3) !important;
      }
      .ts-btn-goback-warning:hover { background: #b45309 !important; }

      .ts-btn-proceed {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        color: #334155 !important;
      }
      .ts-btn-proceed:hover { background: #f8fafc !important; border-color: #94a3b8 !important; }

      .ts-btn-report {
        background: #e0e7ff !important;
        border: 1px solid #c7d2fe !important;
        color: #4338ca !important;
      }
      .ts-btn-report:hover { background: #c7d2fe !important; }

      /* ── Animations ── */
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

  // ── SAFE Toast Handler (Green Pass-through: auto-dismiss in 2.5s) ──────────

  function showSafeToast(payload) {
    removeAll();
    clearTimeout(fallbackTimer);
    unhidePage();

    const { url, score } = payload;
    const scorePct = Math.min(100, Math.max(0, Math.round(score || 0)));

    const el = document.createElement("div");
    el.id = TOAST_ID;
    el.innerHTML = `
      <div class="ts-toast-inner">
        <span class="ts-toast-icon">🛡️</span>
        <div class="ts-toast-body">
          <div class="ts-toast-header">
            <span class="ts-toast-title">ThreatShield Protection</span>
            <span class="ts-toast-badge">Risk: ${scorePct}%</span>
          </div>
          <div class="ts-toast-sub">Verdict: Safe · ${esc(url)}</div>
        </div>
        <button class="ts-toast-close" id="ts-toast-x">✕</button>
      </div>
    `;
    (document.body || document.documentElement).appendChild(el);
    el.querySelector("#ts-toast-x")?.addEventListener("click", () => el.remove());

    setTimeout(() => {
      if (el && el.parentNode) {
        el.remove();
      }
    }, 2500);
  }

  // ── Pastel Protection Overlay Handler (Red / Amber Threat Block Screen) ────

  function showProtectionOverlay(payload) {
    removeAll();
    clearTimeout(fallbackTimer);

    const { url, verdict, score, reasons, reportUrl } = payload;
    const scorePct = Math.min(100, Math.max(0, Math.round(score || 0)));
    const isPhishing = verdict.toLowerCase() === "phishing" || verdict.toLowerCase() === "dangerous";
    
    const titleText = isPhishing ? "High-Risk Threat Blocked" : "Suspicious Website Detected";
    const icon = isPhishing ? "🚨" : "⚠️";
    const badgeClass = isPhishing ? "ts-badge-danger" : "ts-badge-warning";
    const cardClass = isPhishing ? "ts-card-danger" : "ts-card-warning";
    const titleClass = isPhishing ? "ts-title-danger" : "ts-title-warning";
    const btnGoBackClass = isPhishing ? "ts-btn-goback-danger" : "ts-btn-goback-warning";

    const reasonsListHtml = (reasons && reasons.length > 0 ? reasons : ["Potential phishing pattern or security policy risk detected."])
      .map(r => `<div class="ts-reason-item"><span>•</span><span>${esc(r)}</span></div>`)
      .join("");

    const el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.innerHTML = `
      <div class="${cardClass}">
        <div class="ts-icon">${icon}</div>
        <div class="${titleClass}">${titleText}</div>
        
        <div class="ts-metrics">
          <span class="ts-metric-badge ${badgeClass}">Verdict: ${esc(verdict)}</span>
          <span class="ts-metric-badge ts-badge-score">Risk Score: ${scorePct}%</span>
        </div>

        <div class="ts-url-box">URL: ${esc(url)}</div>

        <div class="ts-reasons">
          <div class="ts-reasons-title">Security & Policy Intelligence</div>
          ${reasonsListHtml}
        </div>

        <div class="ts-actions">
          <button class="ts-btn ${btnGoBackClass}" id="ts-btn-block">Back</button>
          <button class="ts-btn ts-btn-proceed" id="ts-btn-continue">Proceed Anyway</button>
          <button class="ts-btn ts-btn-report" id="ts-btn-report">Details</button>
        </div>
        <p style="color: ${isPhishing ? '#991b1b' : '#92400e'}; font-size: 12px; margin-top: 16px; opacity: 0.8; font-weight: 500;">
          ${isPhishing ? 'This website was blocked to protect your credentials and data.' : 'Exercise caution before entering passwords or submitting information.'}
        </p>
      </div>
    `;
    (document.body || document.documentElement).appendChild(el);

    // Back action: Navigates to previous page or search engine
    el.querySelector("#ts-btn-block")?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "https://www.google.com";
      }
      el.remove();
    });

    // Proceed Anyway action: Unhides page and dismisses overlay
    el.querySelector("#ts-btn-continue")?.addEventListener("click", () => {
      unhidePage();
      el.remove();
    });

    // Threat details report action
    el.querySelector("#ts-btn-report")?.addEventListener("click", () => {
      openTab(reportUrl);
    });
  }

  // ── Extension Message Listener ─────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "THREATSHIELD_PING" || message?.type === "GATEKEEPER_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "THREATSHIELD_RESULT" || message?.type === "GATEKEEPER_RESULT") {
      injectStyles();
      const payload = message.payload;
      const scorePct = Math.min(100, Math.max(0, Math.round(payload?.score || payload?.raw_score || 0)));
      const thresholdPct = Math.min(100, Math.max(0, Math.round(payload?.threshold || 70)));
      const verdict = (payload?.verdict || "Safe").toLowerCase();

      // If risk score ≥ configured threshold or verdict is Dangerous/Phishing/Suspicious:
      if (scorePct >= thresholdPct || verdict === "phishing" || verdict === "dangerous" || verdict === "suspicious") {
        showProtectionOverlay(payload);
      } else {
        showSafeToast(payload);
      }

      sendResponse({ ok: true });
      return;
    }
  });
})();
