"""FastAPI Application for NetSentinel Intrusion Detection System.

Implements the contract defined in docs/api_contract.md:
- GET  /api/v1/health
- POST /api/v1/validate
- POST /api/v1/predict
- POST /api/v1/explain
- GET  /api/v1/training-context
"""

import io
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

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
    CLASSES,
    FINAL_METRICS_PATH,
    METADATA_ARTIFACT_PATH,
    MODEL_ARTIFACT_PATH,
    RAW_INPUT_FEATURES,
)
from ml.src.predict import (
    explain_row_prediction,
    load_model_package,
    predict_dataframe,
    validate_dataframe,
)

app = FastAPI(
    title="NetSentinel IDS API",
    description="Network Intrusion Detection System Inference API for UNSW-NB15",
    version="2.0.0",
)

# Enable CORS for local and staging frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExplainRequest(BaseModel):
    row_features: Dict[str, Any] = Field(
        ..., description="Key-value mapping of feature names to values for a single flow"
    )


@app.on_event("startup")
def startup_event():
    """Preload model artifacts on startup to avoid cold start latency."""
    try:
        load_model_package()
        print("Model package loaded successfully into memory.")
    except Exception as e:
        print(f"Warning: Could not preload model package: {e}")


@app.get("/")
@app.get("/api/v1/health")
def health_check():
    """Health check and model telemetry."""
    return {
        "status": "healthy",
        "service": "NetSentinel IDS API",
        "version": "2.0.0",
        "model_name": "RandomForestClassifier",
        "secondary_model": "DecisionTreeClassifier",
        "model_version": "v2.0-clean",
        "classes": CLASSES,
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
    """Returns decision tree path and random forest vote breakdown for a single network flow."""
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


@app.get("/api/v1/training-context")
def get_training_context():
    """Returns offline training dataset statistics and offline baseline comparison."""
    if FINAL_METRICS_PATH.exists():
        with open(FINAL_METRICS_PATH, "r") as f:
            metrics_data = json.load(f)
    else:
        metrics_data = {}

    return {
        "dataset": "UNSW-NB15",
        "citation": "Moustafa & Slay (2015)",
        "offline_training_records": 89725,
        "offline_testing_records": 59543,
        "classes": CLASSES,
        "cv_scheme": "Block-Grouped 5-Fold Stratified Cross-Validation",
        "models_evaluated": [
            {"name": "Dummy (Stratified)", "macro_f1": 0.1407, "far": 0.4179, "notes": "Baseline"},
            {"name": "DecisionTree (Depth 12)", "macro_f1": 0.4824, "far": 0.1893, "notes": "Interpretable"},
            {"name": "RandomForest Baseline", "macro_f1": 0.4872, "far": 0.1800, "notes": "Raw features"},
            {"name": "RandomForest + Ratios", "macro_f1": 0.4940, "far": 0.1777, "notes": "Winning Production Model"},
            {"name": "HistGradientBoosting + Ratios", "macro_f1": 0.5049, "far": 0.1807, "notes": "Gradient Boosted"},
        ],
        "winning_model": "RandomForestClassifier + Ratios",
        "hard_classes": ["Analysis", "Backdoor"],
        "banner_text": "Trained offline on UNSW-NB15 (2015 testbed); this page runs predictions only.",
        "final_test_metrics": metrics_data.get("overall_metrics", {}),
    }
