// Gatekeeper Extension Background Script
// Uses JWT authentication for personalized scanning

const WEBAPP_BASE = "http://localhost:5001";
const ANALYZE_API = `${WEBAPP_BASE}/api/analyze`;
const SCANS_API = `${WEBAPP_BASE}/api/scans`;

let currentToken = null;
let currentUser = null;
let settings = {
  protection_enabled: true,
  auto_scan_enabled: true
};

// Load token and user from storage on startup
async function loadAuth() {
  const result = await chrome.storage.local.get(['gatekeeper_token', 'gatekeeper_user', 'protection_enabled', 'auto_scan_enabled']);
  currentToken = result.gatekeeper_token || null;
  currentUser = result.gatekeeper_user || null;
  settings.protection_enabled = result.protection_enabled !== false;
  settings.auto_scan_enabled = result.auto_scan_enabled !== false;
  console.log('Gatekeeper: Auth loaded', { hasToken: !!currentToken, user: currentUser?.email, settings });
}

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
  if (!currentToken) {
    throw new Error('Not authenticated');
  }
  
  const res = await fetch(ANALYZE_API, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${currentToken}`
    },
    body: JSON.stringify({ url })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      await handleUnauthorized();
    }
    throw new Error(`Analyze API ${res.status}: ${text}`);
  }
  return await res.json();
}

async function saveScan(scanData) {
  if (!currentToken) {
    throw new Error('Not authenticated');
  }
  
  const res = await fetch(SCANS_API, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${currentToken}`
    },
    body: JSON.stringify(scanData)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      await handleUnauthorized();
    }
    throw new Error(`Save scan API ${res.status}: ${text}`);
  }
  return await res.json();
}

async function handleUnauthorized() {
  console.log('Gatekeeper: Token expired, clearing auth');
  await chrome.storage.local.remove(['gatekeeper_token', 'gatekeeper_refresh_token', 'gatekeeper_user']);
  currentToken = null;
  currentUser = null;
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

  const rawVerdict = (out?.verdict || "Safe").toLowerCase();
  let verdict = "Safe";
  if (rawVerdict === "dangerous" || rawVerdict === "phishing" || out?.prediction === 1) {
    verdict = "Phishing";
  } else if (rawVerdict === "suspicious") {
    verdict = "Suspicious";
  }

  const rawScore = out?.risk_score ?? 1;
  const riskScore10 = Math.min(10, Math.max(1, Math.ceil(rawScore / 10)));
  const threshold = settings.risk_threshold || 7;
  const inOpenPhish = out?.stages?.threat_api?.in_openphish || false;
  const reasons = out?.reasons || [];

  const msg = {
    type: "GATEKEEPER_RESULT",
    payload: {
      url,
      verdict,
      score: riskScore10,
      raw_score: rawScore,
      threshold,
      risk_color: out?.risk_color || (verdict === "Phishing" ? "red" : verdict === "Suspicious" ? "yellow" : "green"),
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
    if (!settings.protection_enabled) return;
    if (!currentToken) return;

    // Debounce — skip if same URL was checked in the last 3 seconds
    const key = `last:${tabId}`;
    const prev = (await chrome.storage.session.get(key))[key];
    if (prev && prev.url === url && Date.now() - prev.t < 3000) return;
    await chrome.storage.session.set({ [key]: { url, t: Date.now() } });

    const out = await analyzeUrl(url);
    if (out) {
      // Save scan to user's history
      if (currentUser) {
        const scanData = {
          url: out.url,
          verdict: out.verdict.toLowerCase(),
          risk_score: out.risk_score,
          risk_color: out.risk_color,
          phishing_probability: out.phishing_probability || 0,
          prediction: out.prediction,
          reasons: out.reasons || [],
          stages: out.stages || {},
          page_inspect_result: out.stages?.page_inspect || {},
          organization_id: currentUser.memberships?.[0]?.organization_id || null
        };
        try {
          await saveScan(scanData);
        } catch (e) {
          console.error('Gatekeeper: Failed to save scan', e.message);
        }
      }
      await sendResult(tabId, url, out);
    }
  } catch (e) {
    console.error("Gatekeeper error:", e.message);
  }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GATEKEEPER_LOGOUT") {
    handleUnauthorized();
    sendResponse({ ok: true });
    return true;
  }
  
  if (message?.type === "GATEKEEPER_SETTINGS_UPDATE") {
    if (message.protection_enabled !== undefined) {
      settings.protection_enabled = message.protection_enabled;
    }
    if (message.auto_scan_enabled !== undefined) {
      settings.auto_scan_enabled = message.auto_scan_enabled;
    }
    if (message.risk_threshold !== undefined) {
      settings.risk_threshold = message.risk_threshold;
    }
    sendResponse({ ok: true });
    return true;
  }
  
  if (message?.type === "GATEKEEPER_AUTH_UPDATE") {
    loadAuth();
    sendResponse({ ok: true });
    return true;
  }
  
  return false;
});

// Navigation event listeners
chrome.webNavigation.onCommitted.addListener((d) => {
  if (d.frameId !== 0) return;
  if (settings.auto_scan_enabled) {
    handleUrl(d.tabId, d.url);
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((d) => {
  if (d.frameId !== 0) return;
  if (settings.auto_scan_enabled) {
    handleUrl(d.tabId, d.url);
  }
});

// Real-time tab update listener: catches navigation as early as loading status
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab?.url;
  if (!targetUrl) return;
  if (settings.auto_scan_enabled && (changeInfo.status === "loading" || changeInfo.status === "complete")) {
    handleUrl(tabId, targetUrl);
  }
});

// Initialize on startup
loadAuth();

// Listen for storage changes (e.g., login from popup)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.gatekeeper_token || changes.gatekeeper_user)) {
    loadAuth();
  }
});