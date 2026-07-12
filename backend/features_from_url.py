import re
from urllib.parse import urlparse


# ── Individual feature extractors ─────────────────────────────────────────────

def has_ip_address(url: str) -> int:
    try:
        host = urlparse(url).netloc.split(":")[0]
    except Exception:
        host = url
    ip_regex = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
    return 1 if ip_regex.match(host) else -1


def url_length_feature(url: str) -> int:
    length = len(url)
    if length < 54:
        return -1
    elif length <= 75:
        return 0
    else:
        return 1


def shortening_service(url: str) -> int:
    shorteners = [
        "bit.ly", "goo.gl", "tinyurl.com", "t.co", "ow.ly",
        "is.gd", "buff.ly", "adf.ly", "bit.do", "rebrand.ly",
        "short.link", "cutt.ly", "rb.gy"
    ]
    host = urlparse(url).netloc.lower()
    return 1 if any(s in host for s in shorteners) else -1


def having_at_symbol(url: str) -> int:
    return 1 if "@" in url else -1


def double_slash_redirecting(url: str) -> int:
    first = url.find("//")
    return 1 if url.find("//", first + 2) != -1 else -1


def prefix_suffix(url: str) -> int:
    host = urlparse(url).netloc
    return 1 if "-" in host else -1


def sub_domain(url: str) -> int:
    host = urlparse(url).hostname or ""
    parts = host.split(".")
    if len(parts) <= 2:
        return -1
    elif len(parts) == 3:
        return 0
    else:
        return 1


def ssl_final_state(url: str) -> int:
    return -1 if url.lower().startswith("https://") else 1


def domain_registration_length() -> int:
    return -1


def favicon_feature() -> int:
    return 0


def port_feature(url: str) -> int:
    parsed = urlparse(url)
    if parsed.port is None:
        return -1
    return 1 if parsed.port not in (80, 443) else -1


def https_token(url: str) -> int:
    host = urlparse(url).netloc.lower()
    clean = host.replace("https://", "")
    return 1 if "https" in clean else -1


def neutral_zero() -> int:
    return 0


def neutral_minus1() -> int:
    return -1


def submitting_to_email(url: str) -> int:
    return 1 if "mailto:" in url else -1


def abnormal_url(url: str) -> int:
    parsed = urlparse(url)
    host = parsed.netloc
    return -1 if host and host in url else 1


def digit_substitution(url: str) -> int:
    """Check for common digit substitution patterns in the domain."""
    host = urlparse(url).hostname or ""
    # Common substitutions: paypa1, g00gle, micr0s0ft, faceb00k
    suspicious_patterns = [
        r'[0-9][a-z]|[a-z][0-9]',  # mixed digits and letters
    ]
    # Look in just the domain/subdomain part
    for p in suspicious_patterns:
        if re.search(p, host):
            return 1
    return -1


def special_char_count(url: str) -> int:
    """Count suspicious special characters."""
    specials = re.findall(r'[%~=&\$\*\!]', url)
    if len(specials) > 4:
        return 1
    elif len(specials) > 2:
        return 0
    return -1


# ── Main feature extraction (30 features matching phishing.csv order) ─────────

def extract_features_from_url(url: str):
    return [
        has_ip_address(url),           # 1  Having_IP_Address
        url_length_feature(url),        # 2  URL_Length
        shortening_service(url),        # 3  Shortining_Service
        having_at_symbol(url),          # 4  Having_At_Symbol
        double_slash_redirecting(url),  # 5  Double_slash_redirecting
        prefix_suffix(url),             # 6  Prefix_Suffix
        sub_domain(url),                # 7  Sub_Domain
        ssl_final_state(url),           # 8  SSLfinal_State
        domain_registration_length(),   # 9  Domain_registeration_length
        favicon_feature(),              # 10 Favicon
        port_feature(url),              # 11 Port
        https_token(url),              # 12 HTTPS_token
        neutral_zero(),                 # 13 Request_URL
        neutral_zero(),                 # 14 URL_of_Anchor
        neutral_zero(),                 # 15 Links_in_tags
        neutral_zero(),                 # 16 SFH
        submitting_to_email(url),       # 17 Submitting_to_email
        abnormal_url(url),              # 18 Abnormal_URL
        neutral_zero(),                 # 19 Redirect
        neutral_zero(),                 # 20 on_mouseover
        neutral_zero(),                 # 21 RightClick
        neutral_zero(),                 # 22 popUpWidnow
        neutral_zero(),                 # 23 Iframe
        neutral_minus1(),               # 24 age_of_domain
        neutral_minus1(),               # 25 DNSRecord
        neutral_minus1(),               # 26 web_traffic
        neutral_minus1(),               # 27 Page_Rank
        neutral_minus1(),               # 28 Google_Index
        neutral_zero(),                 # 29 Links_pointing_to_page
        neutral_zero(),                 # 30 Statistical_report
    ]


# ── Human-readable reason generation ─────────────────────────────────────────

def generate_reasons(url: str, features: list) -> list:
    """
    Converts the feature vector into human-readable explanations
    for why the URL was flagged. Matches the paper's 9 lexical features.
    """
    reasons = []
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        host_no_port = host.split(":")[0]

        # Feature 1 — IP address
        if features[0] == 1:
            reasons.append("Uses a raw IP address instead of a domain name (e.g., http://192.168.1.1/login)")

        # Feature 2 — URL length
        length = len(url)
        if features[1] == 1:
            reasons.append(f"URL is unusually long ({length} chars) — phishing URLs often pad length to hide the real domain")
        elif features[1] == 0:
            reasons.append(f"URL length is borderline suspicious ({length} chars)")

        # Feature 3 — Shortening service
        if features[2] == 1:
            reasons.append("Uses a link-shortening service (bit.ly, tinyurl, etc.) which hides the true destination")

        # Feature 4 — @ symbol
        if features[3] == 1:
            reasons.append('Contains "@" symbol — browsers ignore everything before it, masking the real host')

        # Feature 5 — Double slash
        if features[4] == 1:
            reasons.append("Contains double-slash redirection (e.g., //evil.com) embedded in the URL path")

        # Feature 6 — Hyphen in domain (prefix-suffix)
        if features[5] == 1:
            reasons.append(f"Domain \"{host_no_port}\" contains hyphens — common in fake domains like secure-paypal.com")

        # Feature 7 — Subdomain depth
        parts = host_no_port.split(".")
        if features[6] == 1:
            reasons.append(f"Excessive subdomain depth ({len(parts)} levels) — attackers nest domains to look legitimate")
        elif features[6] == 0:
            reasons.append(f"Multiple subdomains detected ({len(parts)} levels)")

        # Feature 8 — No HTTPS
        if features[7] == 1:
            reasons.append("URL does not use HTTPS — data sent to this site is not encrypted")

        # Feature 11 — Non-standard port
        if features[10] == 1:
            reasons.append(f"Uses non-standard port ({parsed.port}) — legitimate sites use 80 or 443")

        # Feature 12 — HTTPS in domain name
        if features[11] == 1:
            reasons.append('Domain name contains the word "https" to appear trustworthy (e.g., https-secure-login.com)')

        # Feature 17 — mailto in URL
        if features[16] == 1:
            reasons.append("URL contains a mailto: action — may be designed to harvest email credentials")

        # Digit substitution (extra check, not in main 30)
        domain_label = host_no_port.replace("www.", "").split(".")[0]
        known_brands = [
            "paypal", "google", "microsoft", "facebook", "amazon",
            "apple", "netflix", "instagram", "twitter", "linkedin",
            "chase", "wellsfargo", "bankofamerica", "citibank"
        ]
        for brand in known_brands:
            # Check if domain looks like brand with digit substitution
            digit_map = {"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "6": "g"}
            normalized = domain_label
            for digit, letter in digit_map.items():
                normalized = normalized.replace(digit, letter)
            if normalized == brand and domain_label != brand:
                reasons.append(f'Digit substitution detected — "{domain_label}" mimics "{brand}" (e.g., paypa1 → paypal)')
                break

        # Special characters
        specials = re.findall(r'[%~=&\$\*\!]', url)
        if len(specials) > 4:
            reasons.append(f"Unusual number of special characters ({len(specials)}: {''.join(set(specials))}) in URL")

        # HTTPS misuse check (token in domain)
        if "https" in host_no_port:
            if not any(r.startswith('Domain name contains') for r in reasons):
                reasons.append('Domain contains "https" token — a deceptive tactic to appear encrypted')

    except Exception:
        pass

    if not reasons:
        reasons.append("No major structural anomalies detected in the URL")

    return reasons
