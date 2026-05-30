"""PDF text extraction using pdfplumber."""
from __future__ import annotations

from pathlib import Path


def extract_text(path: str | Path) -> tuple[str, int]:
    """
    Extract full text from a PDF file.
    Returns (full_text, page_count).
    """
    import pdfplumber  # lazy import

    pages: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)

    return "\n\n".join(pages), page_count


def extract_text_by_page(path: str | Path) -> list[tuple[int, str]]:
    """Returns list of (page_number, text) tuples (1-indexed)."""
    import pdfplumber

    result: list[tuple[int, str]] = []
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            result.append((i, page.extract_text() or ""))
    return result
