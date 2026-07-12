/**
 * Gatekeeper — Content Script
 *
 * Displays three types of UI based on the verdict from the backend:
 *   SAFE       → small green toast (top-right, auto-dismisses in 5s)
 *   SUSPICIOUS → persistent yellow banner (top of page) with details + actions
 *   DANGEROUS  → full-screen red blocking overlay with reason checklist
 */
(() => {
  const STYLE_ID = "gatekeeper-style-v2";
  const TOAST_ID = "gatekeeper-toast";
  const BANNER_ID = "gatekeeper-banner";
  const OVERLAY_ID = "gatekeeper-overlay";

  // ── Style injection ────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

      #${TOAST_ID}, #${BANNER_ID}, #${OVERLAY_ID} {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
        all: initial;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
      }

      /* ── Safe Toast ─────────────────────────────────────── */
      #${TOAST_ID} {
        display: block !important;
        position: fixed !important;
        top: 16px !important;
        right: 16px !important;
        z-index: 2147483647 !important;
        width: 320px !important;
        background: #0b1a13 !important;
        border: 1px solid rgba(0,229,179,0.35) !important;
        border-left: 4px solid #00e5b3 !important;
        border-radius: 14px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(0,229,179,0.1) !important;
        overflow: hidden !important;
        animation: gk-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1) !important;
      }
      .gk-toast-inner {
        padding: 14px 16px !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
      }
      .gk-toast-icon { font-size: 20px !important; flex-shrink: 0 !important; }
      .gk-toast-body { flex: 1 !important; }
      .gk-toast-title { font-weight: 700 !important; font-size: 13px !important; color: #00e5b3 !important; margin-bottom: 2px !important; }
      .gk-toast-sub { font-size: 11px !important; color: rgba(255,255,255,0.5) !important; }
      .gk-toast-close {
        all: unset !important;
        cursor: pointer !important;
        color: rgba(255,255,255,0.4) !important;
        font-size: 16px !important;
        line-height: 1 !important;
        padding: 4px !important;
      }
      .gk-toast-close:hover { color: rgba(255,255,255,0.8) !important; }

      /* ── Suspicious Banner ──────────────────────────────── */
      #${BANNER_ID} {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 2147483647 !important;
        background: #1a1500 !important;
        border-bottom: 2px solid #f5c518 !important;
        padding: 12px 20px !important;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5) !important;
        animation: gk-drop-in 0.3s ease-out !important;
      }
      .gk-banner-inner {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        max-width: 1100px !important;
        margin: 0 auto !important;
      }
      .gk-banner-icon { font-size: 22px !important; flex-shrink: 0 !important; }
      .gk-banner-text { flex: 1 !important; }
      .gk-banner-title {
        font-weight: 800 !important;
        font-size: 14px !important;
        color: #f5c518 !important;
        margin-bottom: 3px !important;
      }
      .gk-banner-sub { font-size: 12px !important; color: rgba(255,255,255,0.6) !important; }
      .gk-banner-sub span { color: rgba(255,255,255,0.35) !important; }
      .gk-banner-actions { display: flex !important; gap: 8px !important; flex-shrink: 0 !important; }
      .gk-btn {
        all: unset !important;
        cursor: pointer !important;
        padding: 8px 16px !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        border: 1px solid !important;
        white-space: nowrap !important;
        font-family: 'Inter', sans-serif !important;
        transition: filter 0.15s !important;
      }
      .gk-btn:hover { filter: brightness(1.12) !important; }
      .gk-btn-report {
        background: rgba(245,197,24,0.15) !important;
        border-color: rgba(245,197,24,0.4) !important;
        color: #f5c518 !important;
      }
      .gk-btn-dismiss {
        background: rgba(255,255,255,0.06) !important;
        border-color: rgba(255,255,255,0.12) !important;
        color: rgba(255,255,255,0.6) !important;
      }

      /* ── Dangerous Overlay ──────────────────────────────── */
      #${OVERLAY_ID} {
        display: flex !important;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        background: rgba(8,2,2,0.97) !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        animation: gk-fade-in 0.25s ease-out !important;
        overflow-y: auto !important;
      }
      .gk-overlay-card {
        background: #120303 !important;
        border: 1px solid rgba(255,71,87,0.4) !important;
        border-radius: 20px !important;
        padding: 36px !important;
        max-width: 560px !important;
        width: 100% !important;
        box-shadow: 0 0 60px rgba(255,71,87,0.2) !important;
        text-align: center !important;
      }
      .gk-overlay-icon { font-size: 56px !important; margin-bottom: 16px !important; }
      .gk-overlay-title {
        font-size: 28px !important;
        font-weight: 900 !important;
        color: #ff4757 !important;
        margin-bottom: 8px !important;
        letter-spacing: -0.5px !important;
      }
      .gk-overlay-desc {
        font-size: 14px !important;
        color: rgba(255,255,255,0.55) !important;
        line-height: 1.6 !important;
        margin-bottom: 20px !important;
      }
      .gk-overlay-url {
        background: rgba(255,71,87,0.08) !important;
        border: 1px solid rgba(255,71,87,0.2) !important;
        border-radius: 8px !important;
        padding: 10px 14px !important;
        font-size: 12px !important;
        color: rgba(255,255,255,0.5) !important;
        word-break: break-all !important;
        text-align: left !important;
        margin-bottom: 20px !important;
        font-family: monospace !important;
      }
      .gk-overlay-reasons {
        text-align: left !important;
        margin-bottom: 24px !important;
      }
      .gk-overlay-reasons-title {
        font-size: 11px !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
        color: rgba(255,255,255,0.3) !important;
        margin-bottom: 10px !important;
        font-weight: 600 !important;
      }
      .gk-overlay-reason {
        display: flex !important;
        align-items: flex-start !important;
        gap: 8px !important;
        font-size: 13px !important;
        color: rgba(255,200,200,0.8) !important;
        padding: 6px 0 !important;
        border-bottom: 1px solid rgba(255,71,87,0.1) !important;
        line-height: 1.45 !important;
      }
      .gk-overlay-reason:last-child { border-bottom: none !important; }
      .gk-overlay-reason-icon { flex-shrink: 0 !important; margin-top: 1px !important; }
      .gk-overlay-actions { display: flex !important; gap: 12px !important; justify-content: center !important; }
      .gk-btn-danger {
        background: rgba(255,71,87,0.15) !important;
        border-color: rgba(255,71,87,0.4) !important;
        color: #ff4757 !important;
      }
      .gk-btn-back {
        background: linear-gradient(135deg, #ff4757, #c0392b) !important;
        border-color: transparent !important;
        color: #fff !important;
        padding: 12px 28px !important;
        font-size: 14px !important;
      }

      /* ── Animations ─────────────────────────────────────── */
      @keyframes gk-slide-in {
        from { opacity: 0; transform: translateX(24px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes gk-drop-in {
        from { opacity: 0; transform: translateY(-100%); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes gk-fade-in {
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
    [TOAST_ID, BANNER_ID, OVERLAY_ID].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function openTab(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ── SAFE toast ─────────────────────────────────────────────────────────────

  function showSafeToast(payload) {
    removeAll();
    const { url, score } = payload;
    const el = document.createElement("div");
    el.id = TOAST_ID;
    el.innerHTML = `
      <div class="gk-toast-inner">
        <span class="gk-toast-icon">✅</span>
        <div class="gk-toast-body">
          <div class="gk-toast-title">Gatekeeper — Safe${score !== null ? ` (${score}/10)` : ""}</div>
          <div class="gk-toast-sub">${esc(url.substring(0, 55))}${url.length > 55 ? "…" : ""}</div>
        </div>
        <button class="gk-toast-close" id="gk-toast-x">✕</button>
      </div>
    `;
    (document.body || document.documentElement).appendChild(el);
    el.querySelector("#gk-toast-x").addEventListener("click", () => el.remove());
    setTimeout(() => el.remove(), 5000);
  }

  // ── SUSPICIOUS banner ──────────────────────────────────────────────────────

  function showSuspiciousBanner(payload) {
    removeAll();
    const { url, score, reasons, reportUrl } = payload;
    const el = document.createElement("div");
    el.id = BANNER_ID;
    el.innerHTML = `
      <div class="gk-banner-inner">
        <span class="gk-banner-icon">⚠️</span>
        <div class="gk-banner-text">
          <div class="gk-banner-title">Gatekeeper — Suspicious Link (Risk ${score !== null ? score : "?"}/10)</div>
          <div class="gk-banner-sub">
            ${reasons.length > 0
              ? esc(reasons[0])
              : `This URL has suspicious structural patterns.`
            }
            <span> · ${esc(url.substring(0, 60))}${url.length > 60 ? "…" : ""}</span>
          </div>
        </div>
        <div class="gk-banner-actions">
          <button class="gk-btn gk-btn-report" id="gk-banner-report">Full Report</button>
          <button class="gk-btn gk-btn-dismiss" id="gk-banner-dismiss">Dismiss</button>
        </div>
      </div>
    `;
    (document.body || document.documentElement).prepend(el);
    el.querySelector("#gk-banner-report").addEventListener("click", () => {
      openTab(reportUrl);
      el.remove();
    });
    el.querySelector("#gk-banner-dismiss").addEventListener("click", () => el.remove());
    // Push page content down
    document.body && (document.body.style.marginTop = (el.offsetHeight + 2) + "px");
    el.addEventListener("remove", () => {
      document.body && (document.body.style.marginTop = "");
    });
  }

  // ── DANGEROUS overlay ──────────────────────────────────────────────────────

  function showDangerousOverlay(payload) {
    removeAll();
    const { url, in_openphish, reasons, reportUrl } = payload;

    const reasonsHtml = (reasons.length > 0 ? reasons : ["Multiple phishing indicators detected"])
      .map(r => `<div class="gk-overlay-reason"><span class="gk-overlay-reason-icon">⚠</span><span>${esc(r)}</span></div>`)
      .join("");

    const desc = in_openphish
      ? "This URL is listed in the <strong>OpenPhish live database</strong> of confirmed phishing sites. It has been reported and verified by the security community."
      : "Our analysis detected multiple high-confidence phishing indicators. This site may steal your passwords, banking details, or personal information.";

    const el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.innerHTML = `
      <div class="gk-overlay-card">
        <div class="gk-overlay-icon">🚨</div>
        <div class="gk-overlay-title">Phishing Site Detected</div>
        <div class="gk-overlay-desc">${desc}</div>
        <div class="gk-overlay-url">${esc(url)}</div>
        ${reasons.length > 0 ? `
          <div class="gk-overlay-reasons">
            <div class="gk-overlay-reasons-title">Why Gatekeeper flagged this</div>
            ${reasonsHtml}
          </div>
        ` : ""}
        <div class="gk-overlay-actions">
          <button class="gk-btn gk-btn-back" id="gk-go-back">← Go Back to Safety</button>
          <button class="gk-btn gk-btn-danger" id="gk-proceed">Proceed Anyway</button>
          <button class="gk-btn gk-btn-report" id="gk-report">Full Report</button>
        </div>
      </div>
    `;
    (document.body || document.documentElement).appendChild(el);

    el.querySelector("#gk-go-back").addEventListener("click", () => {
      window.history.go(-1);
      el.remove();
    });
    el.querySelector("#gk-proceed").addEventListener("click", () => {
      if (confirm("⚠ Gatekeeper has detected this as a phishing site. Are you absolutely sure you want to continue?")) {
        el.remove();
      }
    });
    el.querySelector("#gk-report").addEventListener("click", () => {
      openTab(reportUrl);
    });
  }

  // ── Message listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GATEKEEPER_PING") {
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === "GATEKEEPER_RESULT") {
      injectStyles();
      const payload = message.payload;
      const verdict = (payload?.verdict || "").toLowerCase();

      if (verdict === "dangerous") {
        showDangerousOverlay(payload);
      } else if (verdict === "suspicious") {
        showSuspiciousBanner(payload);
      } else {
        showSafeToast(payload);
      }

      sendResponse({ ok: true });
      return;
    }

    // Legacy compat
    if (message?.type === "GATEKEEPER_SHOW_TOAST") {
      injectStyles();
      const { color } = message.payload || {};
      if (color === "red") {
        showDangerousOverlay({
          ...message.payload,
          verdict: "Dangerous",
          in_openphish: false,
          reasons: []
        });
      } else {
        showSafeToast(message.payload);
      }
      sendResponse({ ok: true });
    }
  });
})();
