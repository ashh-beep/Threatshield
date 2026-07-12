// gatekeeper/extension/background.js
// Uses the new /api/analyze endpoint for full 3-stage pipeline results.

const WEBAPP_BASE = "http://localhost:5001";
const ANALYZE_API = `${WEBAPP_BASE}/api/analyze`;

function shouldIgnoreUrl(url) {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("about:") ||
    url.startsWith("edge://") ||
    url.startsWith("file://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("moz-extension://")
  );
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

async function analyzeUrl(url) {
  const res = await fetch(ANALYZE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Analyze API ${res.status}: ${text}`);
  }
  return await res.json();
}

async function ensureContentScript(tabId, maxRetries = 8) {
  for (let i = 0; i < maxRetries; i++) {
    const ok = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "GATEKEEPER_PING" }, (resp) => {
        if (chrome.runtime.lastError) return resolve(false);
        resolve(resp?.ok === true);
      });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function sendResult(tabId, url, out) {
  const reportUrl = `${WEBAPP_BASE}/?url=${encodeURIComponent(url)}`;

  const verdict = out?.verdict || "Unknown";
  const score = out?.risk_score ?? null;
  const inOpenPhish = out?.stages?.threat_api?.in_openphish || false;
  const reasons = out?.reasons || [];

  const msg = {
    type: "GATEKEEPER_RESULT",
    payload: {
      url,
      verdict,
      score,
      risk_color: out?.risk_color || "green",
      in_openphish: inOpenPhish,
      reasons: reasons.slice(0, 4),
      reportUrl
    }
  };

  const ok = await ensureContentScript(tabId);
  if (!ok) return false;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

async function handleUrl(tabId, url) {
  try {
    if (!tabId || !isHttpUrl(url) || shouldIgnoreUrl(url)) return;

    // Debounce — skip if same URL was checked in the last 3 seconds
    const key = `last:${tabId}`;
    const prev = (await chrome.storage.session.get(key))[key];
    if (prev && prev.url === url && Date.now() - prev.t < 3000) return;
    await chrome.storage.session.set({ [key]: { url, t: Date.now() } });

    const out = await analyzeUrl(url);
    if (out) await sendResult(tabId, url, out);
  } catch (e) {
    console.error("Gatekeeper error:", e.message);
  }
}

// ── Navigation event listeners ────────────────────────────────────────────────

chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId !== 0) return;
  handleUrl(d.tabId, d.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId !== 0) return;
  handleUrl(d.tabId, d.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab?.url) return;
  handleUrl(tabId, tab.url);
});
