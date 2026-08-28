// ThreatShield Extension Background Service Worker
// Performs real-time URL analysis and enforcement

const WEBAPP_BASE = "http://localhost:5001";
const ANALYZE_API = `${WEBAPP_BASE}/api/analyze`;
const SCANS_API = `${WEBAPP_BASE}/api/scans`;

let currentToken = null;
let currentUser = null;
let settings = {
  protection_enabled: true,
  auto_scan_enabled: true,
  risk_threshold: 70
};

// Load token and user from storage on startup
async function loadAuth() {
  const result = await chrome.storage.local.get([
    'threatshield_token', 'gatekeeper_token',
    'threatshield_user', 'gatekeeper_user',
    'protection_enabled', 'auto_scan_enabled', 'risk_threshold'
  ]);

  currentToken = result.threatshield_token || result.gatekeeper_token || null;
  currentUser = result.threatshield_user || result.gatekeeper_user || null;
  settings.protection_enabled = result.protection_enabled !== false;
  settings.auto_scan_enabled = result.auto_scan_enabled !== false;
  settings.risk_threshold = result.risk_threshold || 70;

  console.log('ThreatShield: Auth & Settings loaded', { hasToken: !!currentToken, user: currentUser?.email, settings });
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
  const headers = { "Content-Type": "application/json" };
  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }
  
  const res = await fetch(ANALYZE_API, {
    method: "POST",
    headers,
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 && currentToken) {
      await handleUnauthorized();
    }
    throw new Error(`Analyze API ${res.status}: ${text}`);
  }
  return await res.json();
}

async function saveScan(scanData) {
  if (!currentToken) return null;
  
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
  console.log('ThreatShield: Session expired, clearing tokens');
  await chrome.storage.local.remove([
    'threatshield_token', 'gatekeeper_token',
    'threatshield_refresh_token', 'gatekeeper_refresh_token',
    'threatshield_user', 'gatekeeper_user'
  ]);
  currentToken = null;
  currentUser = null;
}

async function ensureContentScript(tabId, maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    const ok = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "THREATSHIELD_PING" }, (resp) => {
        if (chrome.runtime.lastError) return resolve(false);
        resolve(resp?.ok === true);
      });
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 250));
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

  const rawScore = Math.min(100, Math.max(0, Math.round(out?.risk_score ?? 0)));
  const threshold = settings.risk_threshold || 70;
  const inOpenPhish = out?.stages?.threat_api?.in_openphish || false;
  const reasons = out?.reasons || [];

  const msg = {
    type: "THREATSHIELD_RESULT",
    payload: {
      url,
      verdict,
      score: rawScore,
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

    // Debounce — skip if same URL was checked in the last 3 seconds
    const key = `last:${tabId}`;
    const prev = (await chrome.storage.session.get(key))[key];
    if (prev && prev.url === url && Date.now() - prev.t < 3000) return;
    await chrome.storage.session.set({ [key]: { url, t: Date.now() } });

    const out = await analyzeUrl(url);
    if (out) {
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
          console.error('ThreatShield: Failed to save scan', e.message);
        }
      }
      await sendResult(tabId, url, out);
    }
  } catch (e) {
    console.error("ThreatShield scan error:", e.message);
  }
}

// Navigation event listeners
chrome.webNavigation?.onBeforeNavigate?.addListener((details) => {
  if (details.frameId === 0 && isHttpUrl(details.url) && !shouldIgnoreUrl(details.url)) {
    handleUrl(details.tabId, details.url);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && isHttpUrl(changeInfo.url) && !shouldIgnoreUrl(changeInfo.url)) {
    handleUrl(tabId, changeInfo.url);
  }
});

// Message listener
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "THREATSHIELD_LOGOUT") {
    handleUnauthorized();
    sendResponse({ ok: true });
    return true;
  }
  
  if (message?.type === "THREATSHIELD_SETTINGS_UPDATE") {
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
  
  if (message?.type === "THREATSHIELD_AUTH_UPDATE") {
    loadAuth();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// Initial startup load
loadAuth();