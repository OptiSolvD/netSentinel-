# NetSentinel API Contract & Frontend Integration Specification

> **Version**: 2.0.0  
> **Status**: Approved  
> **Primary Audience**: Backend Engineers, Frontend Engineers, ML Engineers  
> **Active serving model**: v3 four-class Decision Tree (`Normal`, `Exploits`, `Fuzzers`, `DoS`). The six-class and Random Forest request/response examples below are historical v2 examples, not the current v3 payload contract.

---

## 1. Overview & Architectural Principles

1. **No Fake Animations**: Every UI indicator, stepper badge, and card renders real telemetry from the backend pipeline.
2. **Strict Schema Separation**:
   - `id` is an index, never a feature. If present in uploaded CSV, it is logged in `ignored_columns` and stripped before feature transformation.
   - `label` (binary 0/1) and `attack_cat` (multi-class string) are ground-truth targets. If present, they are stripped before inference and used to compute online validation metrics (accuracy, macro F1, confusion matrix, false-alarm rate, FP/FN row IDs).
3. **Dual Model Comparison**: The backend runs the primary production model (e.g. Random Forest / HistGradientBoosting) alongside a fast baseline (Decision Tree) to compute real-time model agreement rate and highlight disagreement rows.
4. **On-Demand Explainability**: Heavy explainability details (tree decision path rules and per-tree vote distributions) are served on-demand via `POST /api/v1/explain` to keep prediction payload latency low.

---

## 2. API Endpoints

### 2.1. `GET /api/v1/health`
Health check and model metadata query.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "model_name": "RandomForestClassifier",
  "model_version": "v2.0-clean",
  "classes": ["Normal", "Exploits", "Fuzzers", "DoS", "Analysis", "Backdoor"],
  "num_features": 42,
  "scikit_learn_version": "1.8.0"
}
```

---

### 2.2. `POST /api/v1/validate`
Validates an uploaded CSV file without running full inference. Can be called as Stage 2 in a multi-step stepper or combined within `POST /api/v1/predict`.

**Form-Data**:
- `file`: CSV file (multipart/form-data)

**Response `200 OK`**:
```json
{
  "file_name": "sample_traffic.csv",
  "rows": 500,
  "columns": 45,
  "is_valid": true,
  "has_ground_truth": true,
  "validation_report": {
    "missing_columns": [],
    "extra_columns": ["client_note"],
    "ignored_columns": ["id", "label", "attack_cat"],
    "expected_feature_count": 42
  }
}
```

---

### 2.3. `POST /api/v1/predict`
Primary prediction endpoint. Accepts a CSV file via `multipart/form-data`.

**Form-Data**:
- `file`: CSV file (multipart/form-data)
- `confidence_threshold`: Float (optional, default `0.60`). Predictions below this threshold are flagged as `is_low_confidence: true`.

**Response `200 OK`**:
```json
{
  "pipeline_stages": [
    {
      "stage": "file_received",
      "status": "success",
      "summary": "Received sample_traffic.csv (500 rows, 45 columns)",
      "data": {
        "file_name": "sample_traffic.csv",
        "rows": 500,
        "columns": 45
      }
    },
    {
      "stage": "validation",
      "status": "success",
      "summary": "All 42 required features detected. 3 metadata columns ignored.",
      "data": {
        "missing_columns": [],
        "extra_columns": ["client_note"],
        "ignored_columns": ["id", "label", "attack_cat"]
      }
    },
    {
      "stage": "preprocessing",
      "status": "success",
      "summary": "Filled 12 missing values, handled 1 unseen protocol category. Generated 47 model features.",
      "data": {
        "filled_missing": 12,
        "unseen_categories": {"proto": ["sctp_test"]},
        "n_features_in": 42,
        "n_features_out": 47
      }
    },
    {
      "stage": "prediction",
      "status": "success",
      "summary": "Ran RandomForest (v2.0-clean) in 42.5ms (11,764 rows/s)",
      "data": {
        "primary_model": "RandomForestClassifier",
        "secondary_model": "DecisionTreeClassifier",
        "model_version": "v2.0-clean",
        "inference_ms": 42.5,
        "rows_per_second": 11764.7
      }
    },
    {
      "stage": "results",
      "status": "success",
      "summary": "382 attacks detected (76.4%), 118 normal (23.6%). Agreement: 94.2%",
      "data": {
        "total_rows": 500,
        "attack_count": 382,
        "normal_count": 118,
        "low_confidence_count": 14,
        "model_agreement_rate": 0.942
      }
    }
  ],
  "summary": {
    "total_rows": 500,
    "attack_count": 382,
    "normal_count": 118,
    "low_confidence_count": 14,
    "model_agreement_rate": 0.942,
    "category_counts": {
      "Normal": 118,
      "Exploits": 210,
      "Fuzzers": 105,
      "DoS": 52,
      "Analysis": 10,
      "Backdoor": 5
    },
    "confidence_distribution": {
      "bins": ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"],
      "counts": [0, 2, 12, 84, 402]
    }
  },
  "predictions": [
    {
      "row_index": 0,
      "predicted_class": "Exploits",
      "is_attack": true,
      "confidence": 0.892,
      "is_low_confidence": false,
      "probabilities": {
        "Normal": 0.02,
        "Exploits": 0.892,
        "Fuzzers": 0.051,
        "DoS": 0.025,
        "Analysis": 0.008,
        "Backdoor": 0.004
      },
      "secondary_prediction": {
        "model": "DecisionTreeClassifier",
        "predicted_class": "Exploits",
        "confidence": 1.0,
        "agrees_with_primary": true
      },
      "ground_truth": {
        "has_ground_truth": true,
        "actual_class": "Exploits",
        "is_correct": true
      }
    }
  ],
  "evaluation_metrics": {
    "has_ground_truth": true,
    "accuracy": 0.936,
    "macro_f1": 0.884,
    "attack_recall": 0.962,
    "false_alarm_rate": 0.042,
    "per_class_metrics": {
      "Normal": { "precision": 0.95, "recall": 0.958, "f1": 0.954, "support": 120 },
      "Exploits": { "precision": 0.92, "recall": 0.941, "f1": 0.930, "support": 205 },
      "Fuzzers": { "precision": 0.88, "recall": 0.890, "f1": 0.885, "support": 100 },
      "DoS": { "precision": 0.94, "recall": 0.912, "f1": 0.926, "support": 57 },
      "Analysis": { "precision": 0.70, "recall": 0.625, "f1": 0.660, "support": 11 },
      "Backdoor": { "precision": 0.67, "recall": 0.571, "f1": 0.615, "support": 7 }
    },
    "confusion_matrix": {
      "classes": ["Normal", "Exploits", "Fuzzers", "DoS", "Analysis", "Backdoor"],
      "matrix": [
        [115, 2, 2, 1, 0, 0],
        [3, 193, 7, 1, 1, 0],
        [2, 7, 89, 1, 1, 0],
        [1, 3, 1, 52, 0, 0],
        [1, 2, 1, 0, 7, 0],
        [0, 2, 1, 0, 0, 4]
      ]
    },
    "discrepancy_indices": {
      "false_positives": [42, 189],
      "false_negatives": [12, 98, 204]
    }
  }
}
```

---

### 2.4. `POST /api/v1/explain`
Returns on-demand explainability metrics for a specific single row index from an uploaded file or JSON row features.

**Request Body**:
```json
{
  "row_features": {
    "dur": 0.000011,
    "proto": "udp",
    "service": "-",
    "state": "INT",
    "spkts": 2,
    "dpkts": 0,
    "sbytes": 496,
    "dbytes": 0,
    "rate": 90909.09,
    "sttl": 254,
    "dttl": 0,
    "sload": 180363632.0,
    "dload": 0.0
  }
}
```

**Response `200 OK`**:
```json
{
  "predicted_class": "Exploits",
  "confidence": 0.892,
  "probabilities": {
    "Normal": 0.02,
    "Exploits": 0.892,
    "Fuzzers": 0.051,
    "DoS": 0.025,
    "Analysis": 0.008,
    "Backdoor": 0.004
  },
  "decision_tree_path": [
    "sbytes <= 1200.0 (value: 496.0)",
    "sttl > 60.0 (value: 254.0)",
    "rate > 50000.0 (value: 90909.09)",
    "dpkts <= 1.0 (value: 0.0) -> Exploits"
  ],
  "random_forest_votes": {
    "Normal": 2,
    "Exploits": 89,
    "Fuzzers": 5,
    "DoS": 3,
    "Analysis": 1,
    "Backdoor": 0,
    "total_trees": 100
  }
}
```

---

### 2.5. `GET /api/v1/training-context`
Static metadata describing offline training split, models evaluated, offline metrics, and hard categories.

**Response `200 OK`**:
```json
{
  "dataset": "UNSW-NB15",
  "citation": "Moustafa & Slay (2015)",
  "training_records": 115200,
  "test_records": 59543,
  "class_distribution": {
    "Normal": 56000,
    "Exploits": 33393,
    "Fuzzers": 18184,
    "DoS": 12264,
    "Analysis": 2000,
    "Backdoor": 1746
  },
  "cv_scheme": "Block-Grouped 5-Fold Stratified Cross-Validation",
  "models_evaluated": [
    { "name": "DummyClassifier", "macro_f1": 0.166, "far": 0.0 },
    { "name": "DecisionTreeClassifier", "macro_f1": 0.762, "far": 0.081 },
    { "name": "RandomForestClassifier", "macro_f1": 0.849, "far": 0.038 }
  ],
  "winning_model": "RandomForestClassifier",
  "hard_classes": ["Analysis", "Backdoor"],
  "banner_text": "Trained offline on UNSW-NB15 (2015 testbed); this page runs predictions only."
}
```

### 2.6. `GET /api/v1/model/evaluation`
Returns the stored official held-out v3 test report: four-class confusion matrix and per-class precision, recall, F1, and support. Metric definitions are corrected from the stored confusion matrix: `normal_false_alarm_rate` is Normal rows predicted as an attack divided by all actual Normal rows, and `pooled_attack_recall` counts any attack class predicted as an attack divided by all actual attack rows. `mean_attack_class_recall` is reported separately.

The legacy `final_test_metrics.json` contains mislabeled values for normal false-positive rate and attack recall. The endpoint does not expose those values under their legacy names; it includes a note describing the correction. Historical files remain unchanged.

### 2.7. `GET /api/v1/model-evolution/comparison`
Returns the four-class baseline, final model metadata, validation-only candidate comparisons, corrected metrics derived from saved confusion matrices, grouped cross-validation records, and experiment history. Validation comparisons are only made between candidates evaluated on the same validation split.

The official-test baseline comparison remains `pending_baseline_artifact` when no separate four-class baseline artifact and test predictions are available. The v2 six-class artifact is not used as a substitute. Cross-validation FAR and attack-recall fields are omitted because the saved fold confusion matrices are unavailable and the historical formulas are incorrect.

---

## 3. Frontend UI Architecture & Visual Specification

### 3.1. Pipeline Stepper (Top of Page)
The UI renders a horizontal stepper with 5 cards:
1. **File Received**: Shows file name, row count, column count.
2. **Validation**: Green badge when all 42 network features are present. Warning badge if non-feature columns (`id`, `label`, `attack_cat`) are ignored.
3. **Preprocessing**: Shows `filled_missing`, `unseen_categories`, and conversion from raw inputs to engineered features.
4. **Prediction**: Shows `model`, `model_version`, `inference_ms`, and `rows_per_second`.
5. **Results**: Jumps directly to the summary dashboard.

### 3.2. Results Dashboard
- **Summary Metric Cards**:
  - Total Flows
  - Flagged as Attack (Red badge)
  - Flagged as Normal (Green badge)
  - Low Confidence Alerts (< 60%)
- **Model Comparison Banner**:
  - Displays primary (RF) vs secondary (DT) agreement: `Agreement: 94.2%`.
  - Toggle button: `Show Only Disagreements (29 rows)`.
- **Category Counts Chart**: Horizontal bar chart of the 6 classes.
- **Confidence Distribution Histogram**: 5 bins (0.0 to 1.0).

### 3.3. Interactive Prediction Table
- Columns: `Row #`, `Prediction`, `Confidence`, `DT Secondary`, `Status (Attack/Normal)`, `Actual Class (if provided)`, `Match (Check/Cross)`.
- Filter pills: `All`, `Attacks Only`, `Disagreements Only`, `Low Confidence Only`, `False Positives`, `False Negatives`.
- Click on any row to open the **Why This Prediction Inspector**:
  - Probability bar across all 6 classes.
  - Decision Tree step-by-step logic path.
  - Tree voting distribution strip (100 trees).

### 3.4. Labelled CSV Evaluation Section (Appears only if ground truth exists)
- Macro F1 score, Accuracy, Attack Recall, and False Alarm Rate (FAR).
- Interactive 6x6 Confusion Matrix heatmap with hover counts.
- Per-class precision, recall, and F1 table.

### 3.5. Required UI States
1. **Empty State**: Drag-and-drop box with a button `[Load Sample Attack CSV]` and `[Load Sample Normal CSV]` linked to `data/samples/`.
2. **Uploading & Processing State**: Stepper cards sequentially light up as data streams or processes.
3. **Validation Error State**: Clear error callout listing missing columns and expected schema.
4. **Offline Context Footer**: Permanent banner confirming offline model pedigree.
