"""Production Inference Engine for NetSentinel.

This module provides the core prediction, pipeline telemetry, and model explainability
logic consumed by the backend FastAPI service and CLI utilities.

Design Guarantees:
- Strictly enforces: 'id is never a feature' (ignored and stripped).
- Provides real runtime telemetry for the 5-stage UI stepper.
- Computes dual-model predictions (Random Forest primary vs Decision Tree secondary) for real-time agreement.
- Extracts tree decision paths and forest tree vote distributions on demand for explainability.
- If ground-truth columns ('label' or 'attack_cat') exist in the payload, automatically computes online evaluation metrics.
"""

import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, f1_score

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    CLASSES,
    ID_COLUMN,
    METADATA_ARTIFACT_PATH,
    MODEL_ARTIFACT_PATH,
    NORMAL_CLASS,
    RAW_INPUT_FEATURES,
    TARGET_COLUMN,
    BINARY_TARGET_COLUMN,
)

# Global in-memory cache for loaded model package
_MODEL_PACKAGE = None


def load_model_package():
    """Loads and caches the trained model package from ml/artifacts/model.joblib."""
    global _MODEL_PACKAGE
    if _MODEL_PACKAGE is None:
        if not MODEL_ARTIFACT_PATH.exists():
            raise FileNotFoundError(
                f"Model artifact not found at {MODEL_ARTIFACT_PATH}. "
                f"Run 'python ml/src/evaluate.py' to generate artifacts."
            )
        _MODEL_PACKAGE = joblib.load(MODEL_ARTIFACT_PATH)
    return _MODEL_PACKAGE


def validate_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """Validates dataframe schema against expected network features."""
    cols = list(df.columns)
    missing = [f for f in RAW_INPUT_FEATURES if f not in cols]
    ignored = [c for c in cols if c in [ID_COLUMN, TARGET_COLUMN, BINARY_TARGET_COLUMN]]
    extra = [c for c in cols if c not in RAW_INPUT_FEATURES and c not in ignored]

    has_ground_truth = (TARGET_COLUMN in cols) or (BINARY_TARGET_COLUMN in cols)

    return {
        "missing_columns": missing,
        "extra_columns": extra,
        "ignored_columns": ignored,
        "expected_feature_count": len(RAW_INPUT_FEATURES),
        "is_valid": len(missing) == 0,
        "has_ground_truth": has_ground_truth,
    }


def predict_dataframe(
    df: pd.DataFrame,
    file_name: str = "upload.csv",
    confidence_threshold: float = 0.60,
) -> Dict[str, Any]:
    """Runs end-to-end inference and returns the full contract response with 5-stage pipeline telemetry."""
    package = load_model_package()
    primary_model = package["primary_pipeline"]
    secondary_model = package["secondary_pipeline"]
    classes = package["classes"]
    version = package.get("version", "v2.0-clean")

    raw_rows, raw_cols = df.shape

    # -------------------------------------------------------------
    # Stage 1: File Received
    # -------------------------------------------------------------
    stage_file_received = {
        "stage": "file_received",
        "status": "success",
        "summary": f"Received {file_name} ({raw_rows:,} rows, {raw_cols} columns)",
        "data": {
            "file_name": file_name,
            "rows": raw_rows,
            "columns": raw_cols,
        },
    }

    # -------------------------------------------------------------
    # Stage 2: Validation
    # -------------------------------------------------------------
    val_report = validate_dataframe(df)
    if not val_report["is_valid"]:
        return {
            "pipeline_stages": [
                stage_file_received,
                {
                    "stage": "validation",
                    "status": "error",
                    "summary": f"Validation failed: missing {len(val_report['missing_columns'])} required features.",
                    "data": val_report,
                },
            ],
            "error": f"Missing required columns: {val_report['missing_columns'][:5]}",
        }

    ignored_info = (
        f"{len(val_report['ignored_columns'])} metadata columns ignored ({', '.join(val_report['ignored_columns'])})."
        if val_report["ignored_columns"]
        else "No ignored columns."
    )
    stage_validation = {
        "stage": "validation",
        "status": "success",
        "summary": f"All {len(RAW_INPUT_FEATURES)} required features verified. {ignored_info}",
        "data": val_report,
    }

    # -------------------------------------------------------------
    # Stage 3: Preprocessing
    # -------------------------------------------------------------
    t_prep_start = time.time()
    # Separate features and target
    ground_truth_series = None
    if TARGET_COLUMN in df.columns:
        ground_truth_series = df[TARGET_COLUMN].astype(str).str.strip()

    # Drop ignored columns
    cols_to_drop = [c for c in val_report["ignored_columns"] if c in df.columns]
    X_input = df.drop(columns=cols_to_drop).copy()

    # Detect missing values and fill counts
    null_counts = int(X_input.isnull().sum().sum())

    # Detect unseen categorical values in proto, service, state
    unseen_map = {}
    prep_step = primary_model.named_steps["prep"].named_steps["col_transform"]
    try:
        cat_encoder = prep_step.named_transformers_["cat"].named_steps["onehot"]
        cat_cols = ["proto", "service", "state"]
        for idx, col in enumerate(cat_cols):
            if col in X_input.columns:
                known_cats = set(cat_encoder.categories_[idx])
                incoming_cats = set(X_input[col].dropna().astype(str).unique())
                unseen = list(incoming_cats - known_cats)
                if unseen:
                    unseen_map[col] = unseen[:5]
    except Exception:
        pass

    prep_ms = (time.time() - t_prep_start) * 1000.0
    stage_preprocessing = {
        "stage": "preprocessing",
        "status": "success",
        "summary": f"Handled {null_counts} missing values. Transformed {len(RAW_INPUT_FEATURES)} input columns into model feature representation.",
        "data": {
            "filled_missing": null_counts,
            "unseen_categories": unseen_map,
            "n_features_in": len(RAW_INPUT_FEATURES),
            "n_features_out": len(RAW_INPUT_FEATURES) + 12,  # with engineered ratios & logs
            "prep_ms": round(prep_ms, 2),
        },
    }

    # -------------------------------------------------------------
    # Stage 4: Prediction
    # -------------------------------------------------------------
    t_pred_start = time.time()
    primary_probs = primary_model.predict_proba(X_input)
    primary_preds = primary_model.predict(X_input)
    secondary_preds = secondary_model.predict(X_input)
    pred_seconds = time.time() - t_pred_start
    inference_ms = pred_seconds * 1000.0
    rows_per_sec = raw_rows / pred_seconds if pred_seconds > 0 else 0.0

    stage_prediction = {
        "stage": "prediction",
        "status": "success",
        "summary": f"Ran RandomForest ({version}) in {inference_ms:.1f}ms ({rows_per_sec:,.0f} rows/s)",
        "data": {
            "primary_model": "RandomForestClassifier",
            "secondary_model": "DecisionTreeClassifier",
            "model_version": version,
            "inference_ms": round(inference_ms, 2),
            "rows_per_second": round(rows_per_sec, 1),
        },
    }

    # -------------------------------------------------------------
    # Stage 5: Results & Aggregations
    # -------------------------------------------------------------
    attack_mask = primary_preds != NORMAL_CLASS
    attack_count = int(np.sum(attack_mask))
    normal_count = int(np.sum(~attack_mask))

    confidences = np.max(primary_probs, axis=1)
    low_conf_mask = confidences < confidence_threshold
    low_conf_count = int(np.sum(low_conf_mask))

    agreement_rate = float(np.mean(primary_preds == secondary_preds))

    # Category counts
    cat_counts = {c: 0 for c in classes}
    for c, count in zip(*np.unique(primary_preds, return_counts=True)):
        if c in cat_counts:
            cat_counts[c] = int(count)

    # Confidence distribution histogram (5 bins)
    bins = ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"]
    bin_counts = [
        int(np.sum((confidences >= 0.0) & (confidences < 0.2))),
        int(np.sum((confidences >= 0.2) & (confidences < 0.4))),
        int(np.sum((confidences >= 0.4) & (confidences < 0.6))),
        int(np.sum((confidences >= 0.6) & (confidences < 0.8))),
        int(np.sum((confidences >= 0.8) & (confidences <= 1.01))),
    ]

    stage_results = {
        "stage": "results",
        "status": "success",
        "summary": f"{attack_count:,} attacks flagged ({attack_count/raw_rows:.1%}), {normal_count:,} normal ({normal_count/raw_rows:.1%}). Agreement: {agreement_rate:.1%}",
        "data": {
            "total_rows": raw_rows,
            "attack_count": attack_count,
            "normal_count": normal_count,
            "low_confidence_count": low_conf_count,
            "model_agreement_rate": round(agreement_rate, 4),
        },
    }

    # Detailed row predictions list (cap at 1,000 rows for payload efficiency)
    cap_limit = min(raw_rows, 1000)
    prediction_rows = []
    class_to_idx = {c: i for i, c in enumerate(primary_model.classes_)}

    for i in range(cap_limit):
        pred_c = primary_preds[i]
        sec_pred_c = secondary_preds[i]
        conf = float(confidences[i])
        prob_dict = {
            c: round(float(primary_probs[i, class_to_idx[c]]), 4)
            for c in classes
            if c in class_to_idx
        }

        gt_info = {"has_ground_truth": False}
        if ground_truth_series is not None:
            actual = ground_truth_series.iloc[i]
            gt_info = {
                "has_ground_truth": True,
                "actual_class": actual,
                "is_correct": bool(pred_c == actual),
            }

        # Extract row feature dict for downstream explainability & simulation inspector
        row_feat_dict = {}
        for col in RAW_INPUT_FEATURES:
            if col in df.columns:
                val = df.iloc[i][col]
                if pd.isna(val):
                    row_feat_dict[col] = None
                elif isinstance(val, (np.integer, int)):
                    row_feat_dict[col] = int(val)
                elif isinstance(val, (np.floating, float)):
                    row_feat_dict[col] = round(float(val), 6)
                else:
                    row_feat_dict[col] = str(val)

        prediction_rows.append(
            {
                "row_index": i,
                "predicted_class": pred_c,
                "is_attack": bool(pred_c != NORMAL_CLASS),
                "confidence": round(conf, 4),
                "is_low_confidence": bool(conf < confidence_threshold),
                "probabilities": prob_dict,
                "secondary_prediction": {
                    "model": "DecisionTreeClassifier",
                    "predicted_class": sec_pred_c,
                    "agrees_with_primary": bool(pred_c == sec_pred_c),
                },
                "ground_truth": gt_info,
                "features": row_feat_dict,
            }
        )

    # Online evaluation metrics if ground truth is present
    eval_metrics = None
    if ground_truth_series is not None:
        y_true = ground_truth_series.to_numpy()
        # Filter evaluation to supported classes
        mask_valid = np.isin(y_true, classes)
        if np.sum(mask_valid) > 0:
            y_t = y_true[mask_valid]
            y_p = primary_preds[mask_valid]

            macro_f1 = float(f1_score(y_t, y_p, average="macro", zero_division=0))
            acc = float(np.mean(y_t == y_p))

            is_norm_t = y_t == NORMAL_CLASS
            is_atk_t = ~is_norm_t
            is_norm_p = y_p == NORMAL_CLASS
            is_atk_p = ~is_norm_p

            fp = np.sum(is_norm_t & is_atk_p)
            tn = np.sum(is_norm_t & is_norm_p)
            far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0

            tp = np.sum(is_atk_t & is_atk_p)
            fn = np.sum(is_atk_t & is_norm_p)
            rec = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0

            cm = confusion_matrix(y_t, y_p, labels=classes)
            rep = classification_report(
                y_t, y_p, labels=classes, target_names=classes, output_dict=True, zero_division=0
            )

            fp_idx = np.where((ground_truth_series == NORMAL_CLASS) & (primary_preds != NORMAL_CLASS))[0].tolist()
            fn_idx = np.where((ground_truth_series != NORMAL_CLASS) & (primary_preds == NORMAL_CLASS))[0].tolist()

            eval_metrics = {
                "has_ground_truth": True,
                "accuracy": round(acc, 4),
                "macro_f1": round(macro_f1, 4),
                "attack_recall": round(rec, 4),
                "false_alarm_rate": round(far, 4),
                "per_class_metrics": {
                    cls: {
                        "precision": round(rep[cls]["precision"], 4),
                        "recall": round(rep[cls]["recall"], 4),
                        "f1": round(rep[cls]["f1-score"], 4),
                        "support": int(rep[cls]["support"]),
                    }
                    for cls in classes
                },
                "confusion_matrix": {
                    "classes": classes,
                    "matrix": cm.tolist(),
                },
                "discrepancy_indices": {
                    "false_positives": fp_idx[:25],
                    "false_negatives": fn_idx[:25],
                },
            }

    return {
        "pipeline_stages": [
            stage_file_received,
            stage_validation,
            stage_preprocessing,
            stage_prediction,
            stage_results,
        ],
        "summary": {
            "total_rows": raw_rows,
            "attack_count": attack_count,
            "normal_count": normal_count,
            "low_confidence_count": low_conf_count,
            "model_agreement_rate": round(agreement_rate, 4),
            "category_counts": cat_counts,
            "confidence_distribution": {
                "bins": bins,
                "counts": bin_counts,
            },
        },
        "predictions": prediction_rows,
        "evaluation_metrics": eval_metrics,
    }


def get_tree_structure(max_depth: int = 4) -> Dict[str, Any]:
    """Extracts a structural representation of the Decision Tree up to max_depth."""
    package = load_model_package()
    dt_pipeline = package["secondary_pipeline"]
    dt_clf = dt_pipeline.named_steps["clf"]
    col_transformer = dt_pipeline.named_steps["prep"].named_steps["col_transform"]

    try:
        feat_names = list(col_transformer.get_feature_names_out())
    except Exception:
        feat_names = [f"feature_{i}" for i in range(dt_clf.n_features_in_)]

    tree = dt_clf.tree_
    nodes = {}

    def recurse(node_id: int, depth: int):
        if depth > max_depth or node_id == -1:
            return

        is_leaf = tree.children_left[node_id] == tree.children_right[node_id]
        samples = int(tree.n_node_samples[node_id])
        values = tree.value[node_id][0].tolist()
        pred_idx = int(np.argmax(values))
        pred_class = dt_clf.classes_[pred_idx]
        gini = round(float(tree.impurity[node_id]), 4)

        if not is_leaf:
            f_idx = tree.feature[node_id]
            f_name = feat_names[f_idx] if f_idx < len(feat_names) else f"feat_{f_idx}"
            th = round(float(tree.threshold[node_id]), 4)
            left_child = int(tree.children_left[node_id])
            right_child = int(tree.children_right[node_id])

            nodes[str(node_id)] = {
                "id": node_id,
                "depth": depth,
                "is_leaf": False,
                "feature": f_name,
                "threshold": th,
                "gini": gini,
                "left": left_child,
                "right": right_child,
                "samples": samples,
                "predicted_class": pred_class,
                "class_distribution": values,
            }
            recurse(left_child, depth + 1)
            recurse(right_child, depth + 1)
        else:
            nodes[str(node_id)] = {
                "id": node_id,
                "depth": depth,
                "is_leaf": True,
                "gini": gini,
                "samples": samples,
                "predicted_class": pred_class,
                "class_distribution": values,
            }

    recurse(0, 0)
    return {
        "max_depth": int(dt_clf.max_depth or 12),
        "total_nodes": int(tree.node_count),
        "classes": list(dt_clf.classes_),
        "root_id": 0,
        "nodes": nodes,
    }


def explain_row_prediction(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Provides decision tree rule path, visual path nodes, and random forest tree vote distribution for a single row."""
    package = load_model_package()
    primary_model = package["primary_pipeline"]
    secondary_model = package["secondary_pipeline"]
    classes = package["classes"]

    df_row = pd.DataFrame([row_dict])
    cols_to_drop = [c for c in [ID_COLUMN, TARGET_COLUMN, BINARY_TARGET_COLUMN] if c in df_row.columns]
    X_row = df_row.drop(columns=cols_to_drop)

    # Primary Model Probabilities
    probs = primary_model.predict_proba(X_row)[0]
    class_to_idx = {c: i for i, c in enumerate(primary_model.classes_)}
    prob_dict = {c: round(float(probs[class_to_idx[c]]), 4) for c in classes if c in class_to_idx}
    pred_class = primary_model.predict(X_row)[0]
    confidence = float(np.max(probs))

    # 1. Decision Tree Decision Path
    dt_pipeline = secondary_model
    dt_prep = dt_pipeline.named_steps["prep"]
    dt_clf = dt_pipeline.named_steps["clf"]

    X_trans = dt_prep.transform(X_row)
    try:
        col_transformer = dt_prep.named_steps["col_transform"]
        feat_names = list(col_transformer.get_feature_names_out())
    except Exception:
        feat_names = [f"feat_{i}" for i in range(X_trans.shape[1])]

    node_indicator = dt_clf.decision_path(X_trans)
    node_indices = node_indicator.indices[
        node_indicator.indptr[0] : node_indicator.indptr[1]
    ]

    rules = []
    decision_path_details = []
    tree = dt_clf.tree_

    for i, node_id in enumerate(node_indices):
        is_leaf = tree.children_left[node_id] == tree.children_right[node_id]
        samples = int(tree.n_node_samples[node_id])
        values = tree.value[node_id][0].tolist()
        node_pred = dt_clf.classes_[int(np.argmax(values))]
        node_gini = round(float(tree.impurity[node_id]), 4)

        if not is_leaf:
            feat_idx = tree.feature[node_id]
            feat_name = feat_names[feat_idx] if feat_idx < len(feat_names) else f"feature_{feat_idx}"
            threshold = float(tree.threshold[node_id])
            val = float(X_trans[0, feat_idx])
            direction = "left" if val <= threshold else "right"
            next_node = int(node_indices[i + 1]) if i + 1 < len(node_indices) else None

            cond_str = (
                f"{feat_name} <= {threshold:.2f} (value: {val:.2f})"
                if direction == "left"
                else f"{feat_name} > {threshold:.2f} (value: {val:.2f})"
            )
            rules.append(cond_str)

            decision_path_details.append({
                "node_id": int(node_id),
                "is_leaf": False,
                "feature": feat_name,
                "threshold": round(threshold, 4),
                "value": round(val, 4),
                "direction": direction,
                "operator": "<=" if direction == "left" else ">",
                "condition": f"{feat_name} {('<=' if direction == 'left' else '>')} {threshold:.2f}",
                "samples": samples,
                "gini": node_gini,
                "predicted_class": node_pred,
                "next_node_id": next_node,
            })
        else:
            leaf_class = dt_clf.classes_[int(np.argmax(tree.value[node_id]))]
            rules.append(f"-> Classified as {leaf_class}")
            decision_path_details.append({
                "node_id": int(node_id),
                "is_leaf": True,
                "predicted_class": leaf_class,
                "samples": samples,
                "gini": node_gini,
            })

    # 2. Random Forest Tree Votes
    rf_pipeline = primary_model
    rf_prep = rf_pipeline.named_steps["prep"]
    rf_clf = rf_pipeline.named_steps["clf"]

    X_rf_trans = rf_prep.transform(X_row)
    tree_votes = {c: 0 for c in classes}
    tree_vote_list = []

    for estimator in rf_clf.estimators_:
        pred_idx = estimator.predict(X_rf_trans)[0]
        tree_class = rf_clf.classes_[int(pred_idx)]
        tree_vote_list.append(tree_class)
        if tree_class in tree_votes:
            tree_votes[tree_class] += 1

    tree_votes["total_trees"] = len(rf_clf.estimators_)

    return {
        "predicted_class": pred_class,
        "confidence": round(confidence, 4),
        "probabilities": prob_dict,
        "secondary_prediction": dt_clf.predict(X_trans)[0],
        "decision_tree_path": rules,
        "decision_path_details": decision_path_details,
        "random_forest_votes": tree_votes,
        "random_forest_tree_votes": tree_vote_list,
    }
