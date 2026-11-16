"""HTTPS with a reliable certificate bundle.

Python from python.org on macOS ships without root certificates, so plain
``urllib`` fails there; ``certifi`` provides Mozilla's bundle everywhere.
"""

from __future__ import annotations

import ssl
import urllib.request

try:
    import certifi

    _CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # fall back to the system store
    _CONTEXT = ssl.create_default_context()


def urlopen(url: str, timeout: float = 180):
    return urllib.request.urlopen(url, timeout=timeout, context=_CONTEXT)
