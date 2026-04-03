"""Health risk prediction service with evidence-based explanation."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from repositories.risk_dataset_repository import RiskDatasetRepository
from schemas.response import WorkflowResponse
from schemas.risk import FeatureContribution, HealthRiskInput, HealthRiskPrediction


@dataclass(frozen=True)
class TrainedRiskModel:
    """Container for the trainable MVP risk model artifacts."""

    scaler: StandardScaler
    encoder: OneHotEncoder
    classifier: LogisticRegression
    classes: Tuple[str, ...]
    feature_names: Tuple[str, ...]


MODEL_ARTIFACT_PATH = Path(__file__).resolve().parents[2] / "models" / "health_risk_model.pkl"
MODEL_METRICS_PATH = Path(__file__).resolve().parents[2] / "models" / "health_risk_model_metrics.json"


def train_and_save_risk_model(
    repository: RiskDatasetRepository | None = None,
    artifact_path: Path | None = None,
) -> Path:
    """Train the health risk model and persist the artifact to disk."""
    repository = repository or RiskDatasetRepository()
    artifact_path = artifact_path or MODEL_ARTIFACT_PATH

    records = repository.list_records()
    feature_rows = [_feature_row_from_source(repository, record) for record in records]
    labels = [record.risk_level for record in records]
    numeric_matrix = np.array(
        [[float(row[field]) for field in repository.NUMERIC_FIELDS] for row in feature_rows],
        dtype=float,
    )
    categorical_matrix = np.array(
        [[str(row[field]) for field in repository.CATEGORICAL_FIELDS] for row in feature_rows],
        dtype=object,
    )

    scaler = StandardScaler()
    encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    scaled_numeric = scaler.fit_transform(numeric_matrix)
    encoded_categorical = encoder.fit_transform(categorical_matrix)
    training_matrix = np.hstack([scaled_numeric, encoded_categorical])

    classifier = LogisticRegression(
        max_iter=1000,
        random_state=42,
    )
    classifier.fit(training_matrix, labels)

    categorical_feature_names = tuple(
        str(name) for name in encoder.get_feature_names_out(list(repository.CATEGORICAL_FIELDS))
    )
    feature_names = tuple(repository.NUMERIC_FIELDS) + categorical_feature_names
    model = TrainedRiskModel(
        scaler=scaler,
        encoder=encoder,
        classifier=classifier,
        classes=tuple(str(item) for item in classifier.classes_),
        feature_names=feature_names,
    )

    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, artifact_path)
    metrics_path = artifact_path.with_name("health_risk_model_metrics.json")
    metrics_path.write_text(
        json.dumps(
            evaluate_risk_model(repository=repository, model=model),
            indent=2,
        ),
        encoding="utf-8",
    )
    return artifact_path


def evaluate_risk_model(
    repository: RiskDatasetRepository | None = None,
    model: TrainedRiskModel | None = None,
) -> Dict[str, object]:
    """Evaluate the health risk model and return serializable metrics."""
    repository = repository or RiskDatasetRepository()
    model = model or joblib.load(MODEL_ARTIFACT_PATH)

    records = repository.list_records()
    feature_rows = [_feature_row_from_source(repository, record) for record in records]
    labels = np.array([record.risk_level for record in records])
    numeric_matrix = np.array(
        [[float(row[field]) for field in repository.NUMERIC_FIELDS] for row in feature_rows],
        dtype=float,
    )
    categorical_matrix = np.array(
        [[str(row[field]) for field in repository.CATEGORICAL_FIELDS] for row in feature_rows],
        dtype=object,
    )

    training_matrix = np.hstack(
        [
            model.scaler.transform(numeric_matrix),
            model.encoder.transform(categorical_matrix),
        ]
    )
    training_predictions = model.classifier.predict(training_matrix)
    training_accuracy = float(accuracy_score(labels, training_predictions))

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores: List[float] = []
    for train_idx, test_idx in cv.split(numeric_matrix, labels):
        fold_scaler = StandardScaler()
        fold_encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        train_numeric = fold_scaler.fit_transform(numeric_matrix[train_idx])
        test_numeric = fold_scaler.transform(numeric_matrix[test_idx])
        train_categorical = fold_encoder.fit_transform(categorical_matrix[train_idx])
        test_categorical = fold_encoder.transform(categorical_matrix[test_idx])
        train_matrix = np.hstack([train_numeric, train_categorical])
        test_matrix = np.hstack([test_numeric, test_categorical])
        fold_classifier = LogisticRegression(max_iter=1000, random_state=42)
        fold_classifier.fit(train_matrix, labels[train_idx])
        fold_predictions = fold_classifier.predict(test_matrix)
        cv_scores.append(float(accuracy_score(labels[test_idx], fold_predictions)))

    confusion = confusion_matrix(labels, training_predictions, labels=list(model.classes))
    return {
        "samples": len(records),
        "classes": list(model.classes),
        "training_accuracy": round(training_accuracy, 4),
        "cross_validation": {
            "folds": 5,
            "mean_accuracy": round(float(np.mean(cv_scores)), 4),
            "std_accuracy": round(float(np.std(cv_scores)), 4),
            "scores": [round(score, 4) for score in cv_scores],
        },
        "training_confusion_matrix": confusion.tolist(),
        "artifact_path": str(MODEL_ARTIFACT_PATH),
    }


def _feature_row_from_source(
    repository: RiskDatasetRepository,
    source: HealthRiskInput | object,
) -> Dict[str, float | str]:
    """Create a model-ready feature row from an input object."""
    row: Dict[str, float | str] = {}
    for field in repository.NUMERIC_FIELDS:
        row[field] = float(getattr(source, field))
    for field in repository.CATEGORICAL_FIELDS:
        row[field] = str(getattr(source, field)).strip()
    return row


class RiskPredictionService:
    """Predict risk labels from tabular data and attach evidence."""

    def __init__(
        self,
        repository: RiskDatasetRepository | None = None,
    ) -> None:
        self.repository = repository or RiskDatasetRepository()

    def predict_risk(self, health_input: HealthRiskInput) -> WorkflowResponse:
        """Run the health risk prediction workflow."""
        model = self._trained_model()
        features = self._feature_row(health_input)
        transformed = self._transform_features(model, features)
        probabilities = model.classifier.predict_proba(transformed)[0]
        predicted_index = int(np.argmax(probabilities))
        predicted_risk = str(model.classes[predicted_index])
        confidence = round(float(probabilities[predicted_index]), 3)
        contributions = self._top_contributions(model, transformed, features, predicted_index)
        explanation = self._build_explanation(predicted_risk, contributions)
        payload = HealthRiskPrediction(
            predicted_risk=predicted_risk,
            confidence=confidence,
            top_contributing_features=contributions,
            explanation=explanation,
        )
        return WorkflowResponse(success=True, message="Health risk workflow completed.", data={"result": payload})

    @lru_cache(maxsize=1)
    def _trained_model(self) -> TrainedRiskModel:
        """Load and cache the trained sklearn model artifact."""
        if not MODEL_ARTIFACT_PATH.exists():
            raise FileNotFoundError(
                f"Health risk model artifact not found at {MODEL_ARTIFACT_PATH}. "
                "Run scripts/train_risk_model.py before using RiskPredictionService."
            )
        return joblib.load(MODEL_ARTIFACT_PATH)

    def _top_contributions(
        self,
        model: TrainedRiskModel,
        transformed: np.ndarray,
        features: Dict[str, float | str],
        predicted_index: int,
    ) -> List[FeatureContribution]:
        """Summarize simple per-feature contributions from the trained linear model."""
        transformed_row = np.asarray(transformed).ravel()
        coefficients = model.classifier.coef_[predicted_index]
        raw_contributions = transformed_row * coefficients

        grouped_scores: Dict[str, float] = {}
        for name, score in zip(model.feature_names, raw_contributions):
            feature_key = name.split("_", 1)[0] if name.startswith("consciousness_") else name
            grouped_scores[feature_key] = grouped_scores.get(feature_key, 0.0) + float(score)

        contributions: List[FeatureContribution] = []
        for field, score in grouped_scores.items():
            value = str(features[field])
            contributions.append(
                FeatureContribution(
                    feature=field,
                    value=value,
                    contribution_score=round(abs(score), 4),
                    rationale=(
                        f"{field} had one of the strongest contributions toward the predicted class in the trained "
                        "logistic regression model."
                    ),
                )
            )

        contributions.sort(key=lambda item: item.contribution_score, reverse=True)
        return contributions[:3]

    def _feature_row(self, source: HealthRiskInput | object) -> Dict[str, float | str]:
        """Create a model-ready feature row from an input object."""
        return _feature_row_from_source(self.repository, source)

    def _transform_features(self, model: TrainedRiskModel, features: Dict[str, float | str]) -> np.ndarray:
        """Transform a single feature row into the classifier input matrix."""
        numeric_matrix = np.array([[float(features[field]) for field in self.repository.NUMERIC_FIELDS]], dtype=float)
        categorical_matrix = np.array(
            [[str(features[field]) for field in self.repository.CATEGORICAL_FIELDS]],
            dtype=object,
        )
        scaled_numeric = model.scaler.transform(numeric_matrix)
        encoded_categorical = model.encoder.transform(categorical_matrix)
        return np.hstack([scaled_numeric, encoded_categorical])

    def _build_explanation(
        self,
        predicted_risk: str,
        contributions: List[FeatureContribution],
    ) -> str:
        _ = contributions
        return f"This profile is classified as {predicted_risk} risk by the trained model."
