"""FastAPI Application for NetSentinel Intrusion Detection System.

Implements the contract defined in docs/api_contract.md:
- GET  /api/v1/health
- POST /api/v1/validate
- POST /api/v1/predict
- POST /api/v1/explain
- GET  /api/v1/training-context
- GET  /api/v1/model/metadata
- GET  /api/v1/model/tree-structure
- GET  /api/v1/model/evaluation
- GET  /api/v1/model-evolution/comparison
"""

from contextlib import asynccontextmanager
import io
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import sklearn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    RAW_INPUT_FEATURES,
    V3_FINAL_METRICS_PATH,
    V3_MODEL_NAME,
)
from ml.src.predict_v3 import (
    explain_row_prediction,
    get_tree_structure,
    load_model_package,
    predict_dataframe,
    validate_dataframe,
)
from backend.app.model_evolution import build_model_evolution_report

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload model artifacts on startup to avoid cold start latency."""
    package = load_model_package()
    print(f"{package['model_name']} ({package['version']}) loaded successfully into memory.")
    yield

app = FastAPI(
    title="NetSentinel IDS API",
    description="Network Intrusion Detection System Inference API for UNSW-NB15",
    version="2.0.0",
    lifespan=lifespan,
)

# Enable CORS for local development and GitHub Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://optisolvd.github.io",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExplainRequest(BaseModel):
    row_features: Dict[str, Any] = Field(
        ..., description="Key-value mapping of feature names to values for a single flow"
    )


class PredictSingleRequest(BaseModel):
    features: Dict[str, Any] = Field(
        ..., description="Key-value mapping of 42 network flow attributes"
    )


class PredictBatchRequest(BaseModel):
    rows: List[Dict[str, Any]] = Field(
        ..., description="List of network flow attribute dictionaries"
    )


@app.get("/")
@app.get("/api/v1/health")
def health_check():
    """Health check and model telemetry."""
    package = load_model_package()
    return {
        "status": "healthy",
        "service": "NetSentinel IDS API",
        "version": "2.0.0",
        "model_name": package["model_name"],
        "model_version": package["version"],
        "classes": package["classes"],
        "num_features": len(RAW_INPUT_FEATURES),
        "scikit_learn_version": sklearn.__version__,
    }


@app.post("/api/v1/validate")
async def validate_csv(file: UploadFile = File(...)):
    """Validates an uploaded CSV against the expected 42 network features."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a .csv file.",
        )

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV file: {str(e)}",
        )

    val_report = validate_dataframe(df)
    return {
        "file_name": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "is_valid": val_report["is_valid"],
        "has_ground_truth": val_report["has_ground_truth"],
        "validation_report": val_report,
    }


@app.post("/api/v1/predict")
async def predict_traffic(
    file: UploadFile = File(...),
    confidence_threshold: float = Form(0.60),
):
    """Processes network traffic CSV and returns 5-stage pipeline telemetry with predictions."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload a standard CSV file.",
        )

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to parse CSV content: {str(e)}",
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty.",
        )

    result = predict_dataframe(
        df=df,
        file_name=file.filename,
        confidence_threshold=confidence_threshold,
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result["error"],
        )

    return result


@app.post("/api/v1/explain")
def explain_row(payload: ExplainRequest):
    """Return the v3 decision path for a single network flow."""
    if not payload.row_features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="row_features dictionary must not be empty.",
        )

    try:
        return explain_row_prediction(payload.row_features)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate explanation: {str(e)}",
        )


@app.post("/api/v1/predict/single")
def predict_single(payload: PredictSingleRequest):
    """Predict one flow and return the v3 class probabilities and tree path."""
    if not payload.features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="features dictionary must not be empty.",
        )
    try:
        exp = explain_row_prediction(payload.features)
        return {
            "prediction": exp["predicted_class"],
            "modelName": exp["model_name"],
            "confidence": exp["confidence"],
            "decisionPath": exp["decision_path_details"],
            "probabilities": exp["probabilities"],
            "ruleTrace": exp["decision_tree_path"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run single flow inference: {str(e)}",
        )


@app.post("/api/v1/predict/batch")
def predict_batch(payload: PredictBatchRequest):
    """Process a batch of network flow dictionaries with the v3 model."""
    if not payload.rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rows list must not be empty.",
        )
    try:
        df = pd.DataFrame(payload.rows)
        return predict_dataframe(df, file_name="batch_api.csv")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run batch inference: {str(e)}",
        )


@app.get("/api/v1/model/tree-structure")
def tree_structure(depth: int = 4):
    """Returns structural topology of the fitted Decision Tree up to specified depth."""
    try:
        return get_tree_structure(max_depth=min(depth, 6))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve tree structure: {str(e)}",
        )


def _load_v3_evaluation_report() -> Dict[str, Any]:
    """Load saved test artifacts and recalculate metrics with audited definitions."""
    package = load_model_package()
    metrics_dir = V3_FINAL_METRICS_PATH.parent
    confusion_path = metrics_dir / "final_test_confusion_matrix.csv"
    per_class_path = metrics_dir / "final_test_classification_report.csv"

    try:
        with V3_FINAL_METRICS_PATH.open(encoding="utf-8") as metrics_file:
            stored_metrics = json.load(metrics_file)
        confusion_frame = pd.read_csv(confusion_path, index_col=0)
        per_class_frame = pd.read_csv(per_class_path)
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Stored v3 evaluation artifact is missing: {error.filename}",
        ) from error
    except (OSError, json.JSONDecodeError, pd.errors.ParserError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read stored v3 evaluation artifacts: {error}",
        ) from error

    classes = package["classes"]
    if not all(name in confusion_frame.index and name in confusion_frame.columns for name in classes):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored confusion matrix does not contain every active model class.",
        )
    if not all(name in set(per_class_frame["class"].astype(str)) for name in classes):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored per-class metrics do not contain every active model class.",
        )

    matrix = [
        [int(confusion_frame.loc[actual, predicted]) for predicted in classes]
        for actual in classes
    ]
    per_class_metrics = []
    for class_name in classes:
        row = per_class_frame.loc[per_class_frame["class"].astype(str) == class_name].iloc[0]
        per_class_metrics.append(
            {
                "class_name": class_name,
                "precision": float(row["precision"]),
                "recall": float(row["recall"]),
                "f1": float(row["f1"]),
                "support": int(row["support"]),
            }
        )

    if sum(sum(row) for row in matrix) != int(stored_metrics["test_rows_evaluated"]):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored confusion matrix row count does not match the test metrics artifact.",
        )

    normal_index = classes.index("Normal")
    normal_support = sum(matrix[normal_index])
    normal_false_alarm_rate = (
        (normal_support - matrix[normal_index][normal_index]) / normal_support
        if normal_support
        else 0.0
    )
    attack_indices = [index for index, name in enumerate(classes) if name != "Normal"]
    attack_support = sum(sum(matrix[index]) for index in attack_indices)
    pooled_attack_recall = (
        sum(matrix[actual][predicted] for actual in attack_indices for predicted in attack_indices)
        / attack_support
        if attack_support
        else 0.0
    )
    mean_attack_class_recall = sum(
        row["recall"] for row in per_class_metrics if row["class_name"] != "Normal"
    ) / len(attack_indices)

    metrics = {
        key: value
        for key, value in stored_metrics.items()
        if key not in {"normal_false_positive_rate", "attack_recall"}
    }
    metrics.update(
        {
            "normal_false_alarm_rate": normal_false_alarm_rate,
            "pooled_attack_recall": pooled_attack_recall,
            "mean_attack_class_recall": mean_attack_class_recall,
        }
    )
    return {
        "source": "official held-out test set",
        "metrics": metrics,
        "metric_note": (
            "Normal false-alarm rate and pooled binary attack recall are recalculated from "
            "the saved confusion matrix. The historical metrics JSON used incorrect labels "
            "for those fields; mean attack-class recall is reported separately."
        ),
        "confusion_matrix": {"classes": classes, "matrix": matrix},
        "per_class_metrics": per_class_metrics,
    }


@app.get("/api/v1/model/metadata")
def model_metadata():
    """Return details for the active four-class model."""
    package = load_model_package()
    classifier = package["classifier"]
    metadata = package["metadata"]
    evaluation = _load_v3_evaluation_report()

    return {
        "model_version": package["version"],
        "model": {
            "name": package["model_name"],
            "type": "Four-class CART Decision Tree",
            "max_depth": classifier.get_depth(),
            "total_nodes": int(classifier.tree_.node_count),
            "decision_mechanism": "Deterministic feature-threshold path from root to leaf",
            "explainability": "Exact decision path and class probabilities",
        },
        "classes": package["classes"],
        "input_features": metadata["predictors"],
        "stored_metrics": metadata,
        "test_metrics": evaluation["metrics"],
        "test_metric_note": evaluation["metric_note"],
    }


@app.get("/api/v1/model/evaluation")
def model_evaluation():
    """Return saved official v3 test metrics with corrected metric definitions."""
    return _load_v3_evaluation_report()


@app.get("/api/v1/model-evolution/comparison")
def model_evolution_comparison():
    """Return split-aware model evolution and comparison data."""
    try:
        package = load_model_package()
        evaluation = _load_v3_evaluation_report()
        return build_model_evolution_report(package, evaluation)
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Required model evolution artifact is missing: {error}",
        ) from error
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError, pd.errors.ParserError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to build model evolution report: {error}",
        ) from error


@app.get("/api/v1/training-context")
def get_training_context():
    """Return the v3 four-class model's offline evaluation context."""
    package = load_model_package()
    metrics_data = _load_v3_evaluation_report()["metrics"]
    metadata = package["metadata"]

    return {
        "dataset": "UNSW-NB15",
        "citation": "Moustafa & Slay (2015)",
        "offline_training_records": metrics_data["train_rows"],
        "offline_testing_records": metrics_data["test_rows_evaluated"] + metrics_data["excluded_test_rows"],
        "classes": package["classes"],
        "cv_scheme": "Four-class model selection on validation data; final evaluation on the held-out test set",
        "models_evaluated": [
            {
                "name": V3_MODEL_NAME,
                "macro_f1": metrics_data["macro_f1"],
                "far": metrics_data["normal_false_alarm_rate"],
                "notes": "Selected four-class model; official held-out test metrics",
            },
        ],
        "winning_model": V3_MODEL_NAME,
        "excluded_test_classes": metadata["excluded_test_classes"],
        "banner_text": f"Trained offline on UNSW-NB15; serving {package['version']} predictions only.",
        "final_test_metrics": {
            "accuracy": metrics_data["accuracy"],
            "macro_f1": metrics_data["macro_f1"],
            "attack_recall": metrics_data["pooled_attack_recall"],
            "mean_attack_class_recall": metrics_data["mean_attack_class_recall"],
            "false_alarm_rate": metrics_data["normal_false_alarm_rate"],
            "weighted_f1": metrics_data["weighted_f1"],
        },
    }
