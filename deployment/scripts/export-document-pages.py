#!/usr/bin/env python3
"""Export authoritative PDF text for the edge deployment."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "codebase"))

from agent_core import DOCUMENTS, document_pages  # noqa: E402


def main() -> None:
    output = {
        document: list(document_pages(document))
        for document in DOCUMENTS
    }
    target = ROOT / "deployment" / "lib" / "document-pages.json"
    target.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
