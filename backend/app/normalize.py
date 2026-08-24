"""Myanmar text normalization: convert Zawgyi input to Unicode.

Farmers often type in Zawgyi (a legacy Myanmar encoding). The embedding model
and the LLM only understand Unicode, so any user input is detected and converted
at the chat boundary before it reaches the pipeline.
"""
from __future__ import annotations

from mmfont.converter import zg12uni51
from myanmartools.zawgyi_detector import ZawgyiDetector

_detector = ZawgyiDetector()

# Probability above which we treat the text as Zawgyi and convert it. The
# detector is conservative, so a high threshold avoids accidentally rewriting
# valid Unicode Myanmar (which scores ~0.0).
ZAWGYI_THRESHOLD = 0.9


def normalize_myanmar(text: str) -> str:
    """Return ``text`` as Unicode, converting from Zawgyi when detected."""
    if not text:
        return text
    try:
        if _detector.get_zawgyi_probability(text) >= ZAWGYI_THRESHOLD:
            return zg12uni51(text)
    except Exception:
        # If detection ever fails, return the original text untouched.
        pass
    return text
