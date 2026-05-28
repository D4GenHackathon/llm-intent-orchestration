"""Prepare guideline PDFs for RAG ingestion.

Outputs:
- data/guidelines/guideline_chunks.jsonl

Optional debug output:
- data/guidelines/<PDF_STEM>.txt
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


DEFAULT_INPUT_DIR = Path("data/guidelines/pdf")
DEFAULT_OUTPUT_DIR = Path("data/guidelines")
DEFAULT_JSONL_NAME = "guideline_chunks.jsonl"


def clean_text(text: str) -> str:
    text = repair_mojibake(text)
    text = text.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"-\n(?=[a-z])", "", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def repair_mojibake(text: str) -> str:
    suspicious_markers = ("Â", "â€™", "â€œ", "â€", "â€“", "â€”")
    if not any(marker in text for marker in suspicious_markers):
        return text

    try:
        return text.encode("cp1252").decode("utf-8")
    except UnicodeError:
        replacements = {
            "Â©": "©",
            "Â®": "®",
            "Â£": "£",
            "Â": "",
            "â€™": "'",
            "â€˜": "'",
            "â€œ": '"',
            "â€": '"',
            "â€“": "-",
            "â€”": "-",
            "â€¦": "...",
        }
        for bad, good in replacements.items():
            text = text.replace(bad, good)
        return text


def extract_with_fitz(pdf_path: Path) -> list[dict[str, Any]] | None:
    try:
        import fitz  # type: ignore[import-not-found]
    except ImportError:
        return None

    pages: list[dict[str, Any]] = []
    with fitz.open(pdf_path) as document:
        for index, page in enumerate(document, start=1):
            pages.append({"page": index, "text": clean_text(page.get_text("text") or "")})
    return pages


def extract_with_pypdf(pdf_path: Path) -> list[dict[str, Any]] | None:
    try:
        from pypdf import PdfReader  # type: ignore[import-not-found]
    except ImportError:
        return None

    reader = PdfReader(str(pdf_path))
    pages: list[dict[str, Any]] = []
    for index, page in enumerate(reader.pages, start=1):
        pages.append({"page": index, "text": clean_text(page.extract_text() or "")})
    return pages


def extract_with_pdfminer(pdf_path: Path) -> list[dict[str, Any]] | None:
    try:
        from pdfminer.high_level import extract_text  # type: ignore[import-not-found]
        from pdfminer.pdfpage import PDFPage  # type: ignore[import-not-found]
    except ImportError:
        return None

    with pdf_path.open("rb") as handle:
        page_count = sum(1 for _ in PDFPage.get_pages(handle))

    pages: list[dict[str, Any]] = []
    for index in range(page_count):
        text = extract_text(str(pdf_path), page_numbers=[index]) or ""
        pages.append({"page": index + 1, "text": clean_text(text)})
    return pages


def extract_pdf_pages(pdf_path: Path) -> list[dict[str, Any]]:
    for extractor in (extract_with_fitz, extract_with_pypdf, extract_with_pdfminer):
        pages = extractor(pdf_path)
        if pages is not None:
            return pages
    raise RuntimeError("No PDF extractor available. Install PyMuPDF, pypdf, or pdfminer.six.")


def write_guideline_text(pdf_path: Path, pages: list[dict[str, Any]], output_dir: Path) -> Path:
    text_path = output_dir / f"{pdf_path.stem}.txt"
    blocks = []
    for page in pages:
        blocks.append(f"=== Page {page['page']} ===\n{page['text']}")
    text_path.write_text("\n\n".join(blocks).strip() + "\n", encoding="utf-8")
    return text_path


def split_paragraphs(text: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    if len(paragraphs) <= 1:
        paragraphs = [part.strip() for part in text.splitlines() if part.strip()]
    return paragraphs


def words(text: str) -> list[str]:
    return re.findall(r"\S+", text)


def word_count(text: str) -> int:
    return len(words(text))


def normalize_chunk_text(parts: list[str]) -> str:
    joined = "\n\n".join(part.strip() for part in parts if part.strip())
    joined = re.sub(r"[ \t]{2,}", " ", joined)
    return joined.strip()


def infer_topic(text: str) -> str | None:
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not 5 <= len(line) <= 140:
            continue
        line_words = line.split()
        looks_numbered = re.match(r"^(\d+(\.\d+)*|[A-Z]\d*\.|Appendix|Chapter|Section)\b", line)
        looks_short_heading = len(line_words) <= 14 and not line.endswith((".", ",", ";", ":"))
        looks_upper = line.upper() == line and any(char.isalpha() for char in line)
        if looks_numbered or looks_short_heading or looks_upper:
            return line
    return None


def make_chunk(
    guideline: str,
    source_path: Path,
    chunk_index: int,
    parts: list[str],
    pages: list[int],
) -> dict[str, Any]:
    text = normalize_chunk_text(parts)
    unique_pages = sorted(set(pages))
    return {
        "id": f"{guideline}_{chunk_index:04d}",
        "text": text,
        "metadata": {
            "guideline": guideline,
            "source": source_path.name,
            "source_path": source_path.as_posix(),
            "chunk_index": chunk_index,
            "pages": unique_pages,
            "page_start": unique_pages[0] if unique_pages else None,
            "page_end": unique_pages[-1] if unique_pages else None,
            "word_count": word_count(text),
            "topic": infer_topic(parts[0]) if parts else None,
        },
    }


def chunk_pages(
    pdf_path: Path,
    pages: list[dict[str, Any]],
    min_words: int,
    max_words: int,
    overlap_words: int,
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_pages: list[int] = []
    current_words = 0
    chunk_index = 1

    def flush_current() -> None:
        nonlocal chunk_index, current_parts, current_pages, current_words
        if not current_parts:
            return
        chunks.append(make_chunk(pdf_path.stem, pdf_path, chunk_index, current_parts, current_pages))
        chunk_index += 1
        current_parts = []
        current_pages = []
        current_words = 0

    for page in pages:
        page_number = int(page["page"])
        for paragraph in split_paragraphs(page["text"]):
            count = word_count(paragraph)
            if count == 0:
                continue

            if count > max_words:
                flush_current()
                paragraph_words = words(paragraph)
                stride = max_words - overlap_words
                for start in range(0, len(paragraph_words), stride):
                    window = paragraph_words[start : start + max_words]
                    if not window:
                        continue
                    if len(window) < min_words and chunks and start > 0:
                        break
                    chunks.append(
                        make_chunk(
                            pdf_path.stem,
                            pdf_path,
                            chunk_index,
                            [" ".join(window)],
                            [page_number],
                        )
                    )
                    chunk_index += 1
                continue

            would_exceed = current_words + count > max_words
            if would_exceed and current_words >= min_words:
                flush_current()

            current_parts.append(paragraph)
            current_pages.append(page_number)
            current_words += count

            if current_words >= max_words:
                flush_current()

    flush_current()
    return chunks


def prepare_guidelines(
    input_dir: Path,
    output_dir: Path,
    jsonl_path: Path,
    min_words: int,
    max_words: int,
    overlap_words: int,
    write_txt: bool,
) -> list[dict[str, Any]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_paths = sorted(input_dir.glob("*.pdf"))
    if not pdf_paths:
        raise FileNotFoundError(f"No PDF files found in {input_dir}")

    all_chunks: list[dict[str, Any]] = []
    for pdf_path in pdf_paths:
        pages = extract_pdf_pages(pdf_path)
        if write_txt:
            write_guideline_text(pdf_path, pages, output_dir)
        all_chunks.extend(chunk_pages(pdf_path, pages, min_words, max_words, overlap_words))

    with jsonl_path.open("w", encoding="utf-8") as handle:
        for chunk in all_chunks:
            handle.write(json.dumps(chunk, ensure_ascii=False) + "\n")

    return all_chunks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert guideline PDFs to JSONL chunks.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--jsonl", type=Path, default=DEFAULT_OUTPUT_DIR / DEFAULT_JSONL_NAME)
    parser.add_argument("--min-words", type=int, default=300)
    parser.add_argument("--max-words", type=int, default=500)
    parser.add_argument("--overlap-words", type=int, default=60)
    parser.add_argument(
        "--write-txt",
        action="store_true",
        help="Also write one extracted .txt file per PDF for debugging.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    chunks = prepare_guidelines(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        jsonl_path=args.jsonl,
        min_words=args.min_words,
        max_words=args.max_words,
        overlap_words=args.overlap_words,
        write_txt=args.write_txt,
    )
    print(f"Wrote {len(chunks)} chunks to {args.jsonl}")


if __name__ == "__main__":
    main()
