"""
Page Inspection module for Gatekeeper.

Performs lightweight DOM-level analysis of a webpage using requests +
BeautifulSoup — no Selenium or OpenCV required. Checks for:
  1. Suspicious form actions (submitting to external domains)
  2. Brand impersonation (content mentions known brands but domain does not)
  3. Hidden DOM elements / obfuscation patterns
  4. Password fields paired with external form actions
"""

import re
import time
import requests
from urllib.parse import urlparse, urljoin

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

KNOWN_BRANDS = [
    "paypal", "google", "microsoft", "facebook", "amazon", "apple",
    "netflix", "instagram", "twitter", "linkedin", "dropbox", "adobe",
    "ebay", "chase", "wellsfargo", "citibank", "bankofamerica", "hsbc",
    "barclays", "dhl", "fedex", "ups", "usps", "yahoo", "outlook",
    "office365", "icloud", "steam", "binance", "coinbase", "robinhood"
]

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _get_base_domain(netloc: str) -> str:
    """Extract registerable domain from netloc (last two labels)."""
    parts = netloc.lower().split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return netloc.lower()


def inspect_page_sync(url: str) -> dict:
    """
    Fetch and inspect a URL for phishing indicators.
    Returns a structured dict with findings.
    """
    result = {
        "url": url,
        "forms": [],
        "suspicious_forms": False,
        "brand_impersonation": False,
        "impersonated_brand": None,
        "suspicious_dom": False,
        "dom_flags": [],
        "has_password_field": False,
        "page_title": None,
        "verdict": "clean",
        "error": None,
        "latency_ms": 0
    }

    if not BS4_AVAILABLE:
        result["error"] = "BeautifulSoup4 not installed"
        result["verdict"] = "unknown"
        return result

    t0 = time.time()
    try:
        parsed_url = urlparse(url)
        base_netloc = parsed_url.netloc.lower()
        base_domain = _get_base_domain(base_netloc)

        resp = requests.get(
            url,
            timeout=10,
            headers=REQUEST_HEADERS,
            allow_redirects=True,
            verify=False  # Some phishing sites have invalid certs
        )
        soup = BeautifulSoup(resp.text, "html.parser")

        # ── Page title ────────────────────────────────────────────────────────
        if soup.title and soup.title.string:
            result["page_title"] = soup.title.string.strip()[:200]

        # ── Form analysis ─────────────────────────────────────────────────────
        forms = soup.find_all("form")
        for form in forms:
            action = (form.get("action") or "").strip()
            method = (form.get("method") or "GET").upper()
            has_pwd = bool(form.find("input", {"type": "password"}))

            if action:
                abs_action = urljoin(url, action)
                action_netloc = urlparse(abs_action).netloc.lower()
                action_domain = _get_base_domain(action_netloc)
                is_external = bool(action_netloc) and action_domain != base_domain
            else:
                is_external = False
                abs_action = url

            form_info = {
                "action": abs_action[:300],
                "method": method,
                "external": is_external,
                "has_password": has_pwd
            }
            result["forms"].append(form_info)

            if is_external:
                result["suspicious_forms"] = True
            if has_pwd:
                result["has_password_field"] = True

        # ── Brand impersonation ───────────────────────────────────────────────
        title_lower = (result["page_title"] or "").lower()
        # Sample visible text (avoid script/style contents)
        for tag in soup(["script", "style", "meta"]):
            tag.decompose()
        visible_text = soup.get_text(separator=" ")[:3000].lower()

        for brand in KNOWN_BRANDS:
            brand_in_domain = brand in base_domain
            brand_in_title = brand in title_lower
            brand_in_text = brand in visible_text[:800]

            if not brand_in_domain and (brand_in_title or brand_in_text):
                # Page content claims to be a brand but domain doesn't match
                result["brand_impersonation"] = True
                result["impersonated_brand"] = brand
                break

        # ── Suspicious DOM patterns ───────────────────────────────────────────
        flags = []

        # Hidden iframes
        hidden_iframes = soup.find_all(
            "iframe",
            style=re.compile(r'display\s*:\s*none|visibility\s*:\s*hidden', re.I)
        )
        if hidden_iframes:
            flags.append(f"{len(hidden_iframes)} hidden iframe(s) detected")

        # Obfuscated JS — only flag truly suspicious patterns, NOT minified/bundled JS.
        # eval() and unescape() appear in all modern bundled apps (webpack, etc.).
        # Only flag "String.fromCharCode" used with very large char arrays — a known
        # phishing obfuscation pattern rarely found in legitimate bundles.
        scripts = soup.find_all("script")
        obf_count = 0
        for s in scripts:
            if s.string and re.search(r'String\.fromCharCode\(\s*\d{2,3}(\s*,\s*\d{2,3}){20,}', s.string):
                obf_count += 1
        if obf_count > 0:
            flags.append(f"Heavily obfuscated JavaScript detected ({obf_count} script(s)) — char-code encoding pattern")

        # Excessive hidden elements.
        # Legitimate sites (Google, Amazon, etc.) commonly have 20–60 hidden elements
        # for dropdowns, modals, and dynamic UI. Only flag extreme counts (>80)
        # paired with other suspicious signals.
        hidden_els = soup.find_all(
            attrs={"style": re.compile(r'display\s*:\s*none', re.I)}
        )
        if len(hidden_els) > 80:
            flags.append(f"{len(hidden_els)} hidden DOM elements detected (unusually high)")

        # Password + external form combo
        if result["has_password_field"] and result["suspicious_forms"]:
            flags.append("Password field submits credentials to an external domain")

        result["dom_flags"] = flags
        # Only mark suspicious_dom if we have actionable signals (not just hidden elements alone)
        meaningful_flags = [f for f in flags if "hidden DOM" not in f]
        result["suspicious_dom"] = len(meaningful_flags) > 0 or (len(hidden_els) > 80 and result["suspicious_forms"])

        # ── Final verdict ─────────────────────────────────────────────────────
        # phishing: brand impersonation OR password field going to external domain
        # suspicious: form sends data externally (without confirmed brand theft)
        # clean: everything else (hidden elements alone are NOT enough to flag)
        if result["brand_impersonation"] or (result["suspicious_forms"] and result["has_password_field"]):
            result["verdict"] = "phishing"
            result["risk_score"] = 9
        elif result["suspicious_forms"]:
            result["verdict"] = "suspicious"
            result["risk_score"] = 6
        else:
            result["verdict"] = "clean"
            result["risk_score"] = 1

    except requests.exceptions.Timeout:
        result["error"] = "Page load timed out (>10s)"
        result["verdict"] = "timeout"
    except Exception as e:
        result["error"] = str(e)
        result["verdict"] = "error"

    result["latency_ms"] = round((time.time() - t0) * 1000)
    return result
