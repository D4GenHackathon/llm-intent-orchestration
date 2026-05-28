"""Build a local vector store from guideline JSONL chunks.

Default mode uses scikit-learn TF-IDF vectors because the project already
depends on scikit-learn. If sentence-transformers is installed, pass
`--backend sentence-transformers` to build MiniLM embeddings instead.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize


DEFAULT_CHUNKS_PATH = Path("data/guidelines/guideline_chunks.jsonl")
DEFAULT_OUTPUT_DIR = Path("data/guidelines/vector_store")
DEFAULT_SENTENCE_TRANSFORMER_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def load_chunks(chunks_path: Path) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    with chunks_path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            text = str(record.get("text", "")).strip()
            if not text:
                continue
            record.setdefault("id", f"chunk_{line_number:04d}")
            chunks.append(record)
    if not chunks:
        raise ValueError(f"No text chunks found in {chunks_path}")
    return chunks


def build_tfidf_embeddings(chunks: list[dict[str, Any]], output_dir: Path) -> tuple[np.ndarray, dict[str, Any]]:
    texts = [str(chunk["text"]) for chunk in chunks]
    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        max_features=20000,
        min_df=1,
        norm="l2",
    )
    matrix = vectorizer.fit_transform(texts)
    embeddings = matrix.astype(np.float32).toarray()
    joblib.dump(vectorizer, output_dir / "vectorizer.pkl")
    return embeddings, {
        "backend": "tfidf",
        "model_name": "sklearn.feature_extraction.text.TfidfVectorizer",
        "vectorizer_path": "vectorizer.pkl",
    }


def build_sentence_transformer_embeddings(
    chunks: list[dict[str, Any]],
    model_name: str,
) -> tuple[np.ndarray, dict[str, Any]]:
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "sentence-transformers is not installed. Install it or use the default --backend tfidf."
        ) from exc

    texts = [str(chunk["text"]) for chunk in chunks]
    model = SentenceTransformer(model_name)
    embeddings = model.encode(
        texts,
        batch_size=32,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=True,
    ).astype(np.float32)
    return embeddings, {
        "backend": "sentence-transformers",
        "model_name": model_name,
    }


def write_metadata(chunks: list[dict[str, Any]], metadata_path: Path) -> None:
    with metadata_path.open("w", encoding="utf-8") as handle:
        for chunk in chunks:
            handle.write(json.dumps(chunk, ensure_ascii=False) + "\n")


def build_vector_store(
    chunks_path: Path,
    output_dir: Path,
    backend: str,
    model_name: str,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    chunks = load_chunks(chunks_path)

    if backend == "sentence-transformers":
        embeddings, backend_config = build_sentence_transformer_embeddings(chunks, model_name)
    else:
        embeddings, backend_config = build_tfidf_embeddings(chunks, output_dir)
        embeddings = normalize(embeddings, norm="l2", axis=1).astype(np.float32)

    np.save(output_dir / "embeddings.npy", embeddings)
    write_metadata(chunks, output_dir / "metadata.jsonl")

    config = {
        **backend_config,
        "chunks_path": chunks_path.as_posix(),
        "embeddings_path": "embeddings.npy",
        "metadata_path": "metadata.jsonl",
        "embedding_dim": int(embeddings.shape[1]),
        "chunk_count": len(chunks),
    }
    (output_dir / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    return config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build local guideline embeddings for RAG retrieval.")
    parser.add_argument("--chunks", type=Path, default=DEFAULT_CHUNKS_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--backend", choices=("tfidf", "sentence-transformers"), default="tfidf")
    parser.add_argument("--model-name", default=DEFAULT_SENTENCE_TRANSFORMER_MODEL)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = build_vector_store(
        chunks_path=args.chunks,
        output_dir=args.output_dir,
        backend=args.backend,
        model_name=args.model_name,
    )
    print(
        "Wrote vector store to "
        f"{args.output_dir} ({config['chunk_count']} chunks, {config['embedding_dim']} dimensions, "
        f"backend={config['backend']})"
    )


if __name__ == "__main__":
    main()
