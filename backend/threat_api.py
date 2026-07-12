"""
Threat Intelligence module for Gatekeeper.

Uses the OpenPhish free feed (updated every 6 hours) to check URLs against
a live database of confirmed phishing sites. Feed is cached in memory with a
2-hour TTL to avoid hammering the API on every request.
"""

import time
import requests

OPENPHISH_FEED_URL = "https://openphish.com/feed.txt"
FEED_TTL_SECONDS = 7200  # 2 hours

# In-memory feed cache
_feed_cache: dict = {
    "urls": set(),
    "fetched_at": 0.0,
    "fetch_error": None
}


def _refresh_feed_if_stale() -> set:
    """Download the OpenPhish feed if cache is expired."""
    now = time.time()
    age = now - _feed_cache["fetched_at"]

    if age < FEED_TTL_SECONDS and _feed_cache["urls"]:
        return _feed_cache["urls"]  # Cache hit

    try:
        headers = {
            "User-Agent": "Gatekeeper-PhishingDetector/1.0",
            "Accept": "text/plain"
        }
        resp = requests.get(OPENPHISH_FEED_URL, timeout=8, headers=headers)
        if resp.status_code == 200:
            lines = resp.text.splitlines()
            feed_set = set()
            for line in lines:
                stripped = line.strip()
                if stripped:
                    feed_set.add(stripped)
                    # Also add without trailing slash variant
                    feed_set.add(stripped.rstrip("/"))
            _feed_cache["urls"] = feed_set
            _feed_cache["fetched_at"] = now
            _feed_cache["fetch_error"] = None
        else:
            _feed_cache["fetch_error"] = f"HTTP {resp.status_code}"
    except Exception as e:
        _feed_cache["fetch_error"] = str(e)

    return _feed_cache["urls"]


def check_openphish_sync(url: str) -> dict:
    """
    Check whether a URL is in the OpenPhish feed.

    Returns a dict with keys:
      - in_openphish (bool)
      - feed_size    (int)
      - checked      (bool)
      - error        (str | None)
      - cache_age_s  (int)
    """
    try:
        feed = _refresh_feed_if_stale()
        url_stripped = url.strip()
        url_no_slash = url_stripped.rstrip("/")

        in_feed = (url_stripped in feed) or (url_no_slash in feed)

        return {
            "in_openphish": in_feed,
            "feed_size": len(feed),
            "checked": True,
            "error": _feed_cache.get("fetch_error"),
            "cache_age_s": int(time.time() - _feed_cache["fetched_at"])
        }
    except Exception as e:
        return {
            "in_openphish": False,
            "feed_size": 0,
            "checked": False,
            "error": str(e),
            "cache_age_s": -1
        }


def get_feed_stats() -> dict:
    """Return stats about the current feed cache (for debugging)."""
    return {
        "feed_size": len(_feed_cache["urls"]),
        "fetched_at": _feed_cache["fetched_at"],
        "age_seconds": int(time.time() - _feed_cache["fetched_at"]),
        "fetch_error": _feed_cache.get("fetch_error")
    }
