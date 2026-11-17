"""Inference and explainability for the v3 four-class model."""

import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix, f1_score

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    BINARY_TARGET_COLUMN,
    ID_COLUMN,
    RAW_INPUT_FEATURES,
    TARGET_COLUMN,
    V3_CLASSES,
    V3_METADATA_ARTIFACT_PATH,
    V3_MODEL_ARTIFACT_PATH,
    V3_MODEL_NAME,
    V3_MODEL_VERSION,
)

_MODEL_PACKAGE: Optional[Dict[str, Any]] = None


def load_model_package() -> Dict[str, Any]:
    """Load and cache the v3 model and its serving metadata."""
    global _MODEL_PACKAGE
    if _MODEL_PACKAGE is None:
        if not V3_MODEL_ARTIFACT_PATH.is_file():
            raise FileNotFoundError(f"V3 model artifact not found at {V3_MODEL_ARTIFACT_PATH}.")
        if not V3_METADATA_ARTIFACT_PATH.is_file():
            raise FileNotFoundError(f"V3 model metadata not found at {V3_METADATA_ARTIFACT_PATH}.")

        model = joblib.load(V3_MODEL_ARTIFACT_PATH)
        if not hasattr(model, "named_steps") or not {"preprocess", "model"}.issubset(model.named_steps):
            raise TypeError("The v3 artifact must be a pipeline with 'preprocess' and 'model' steps.")

        classifier = model.named_steps["model"]
        if not hasattr(classifier, "predict_proba") or not hasattr(classifier, "decision_path"):
            raise TypeError("The v3 model must support class probabilities and decision paths.")

        with V3_METADATA_ARTIFACT_PATH.open(encoding="utf-8") as metadata_file:
            metadata = json.load(metadata_file)

        model_classes = {str(class_name) for class_name in classifier.classes_}
        if model_classes != set(V3_CLASSES):
            raise ValueError(
                f"V3 model classes {sorted(model_classes)} do not match configured classes {V3_CLASSES}."
            )

        _MODEL_PACKAGE = {
            "pipeline": model,
            "preprocessor": model.named_steps["preprocess"],
            "classifier": classifier,
            "classes": list(V3_CLASSES),
            "model_name": V3_MODEL_NAME,
            "version": V3_MODEL_VERSION,
            "metadata": metadata,
        }
    return _MODEL_PACKAGE


def validate_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """Validate the required raw flow feature schema."""
    columns = list(df.columns)
    missing = [feature for feature in RAW_INPUT_FEATURES if feature not in columns]
    ignored = [
        column
        for column in columns
        if column in (ID_COLUMN, TARGET_COLUMN, BINARY_TARGET_COLUMN)
    ]
    extra = [
        column
        for column in columns
        if column not in RAW_INPUT_FEATURES and column not in ignored
    ]
    return {
        "missing_columns": missing,
        "extra_columns": extra,
        "ignored_columns": ignored,
        "expected_feature_count": len(RAW_INPUT_FEATURES),
        "is_valid": not missing,
        "has_ground_truth": TARGET_COLUMN in columns or BINARY_TARGET_COLUMN in columns,
    }


def predict_dataframe(
    df: pd.DataFrame,
    file_name: str = "upload.csv",
    confidence_threshold: float = 0.60,
) -> Dict[str, Any]:
    """Run inference and return pipeline telemetry and four-class predictions."""
    package = load_model_package()
    model = package["pipeline"]
    classifier = package["classifier"]
    preprocessor = package["preprocessor"]
    classes = package["classes"]
    row_count, column_count = df.shape

    file_stage = {
        "stage": "file_received",
        "status": "success",
        "summary": f"Received {file_name} ({row_count:,} rows, {column_count} columns)",
        "data": {"file_name": file_name, "rows": row_count, "columns": column_count},
    }

    validation = validate_dataframe(df)
    if not validation["is_valid"]:
        return {
            "pipeline_stages": [
                file_stage,
                {
                    "stage": "validation",
                    "status": "error",
                    "summary": f"Validation failed: missing {len(validation['missing_columns'])} required features.",
                    "data": validation,
                },
            ],
            "error": f"Missing required columns: {validation['missing_columns'][:5]}",
        }

    ground_truth = (
        df[TARGET_COLUMN].astype(str).str.strip()
        if TARGET_COLUMN in df.columns
        else None
    )
    features = df.loc[:, RAW_INPUT_FEATURES].copy()

    validation_stage = {
        "stage": "validation",
        "status": "success",
        "summary": f"All {len(RAW_INPUT_FEATURES)} required features verified.",
        "data": validation,
    }

    prep_start = time.perf_counter()
    missing_value_count = int(features.isna().sum().sum())
    unseen_categories: Dict[str, List[str]] = {}
    categorical_pipeline = preprocessor.named_transformers_["cat"]
    encoder = categorical_pipeline.named_steps["onehot"]
    categorical_columns = next(
        columns
        for name, _, columns in preprocessor.transformers_
        if name == "cat"
    )
    for index, column in enumerate(categorical_columns):
        known_values = {str(value) for value in encoder.categories_[index]}
        incoming_values = set(features[column].dropna().astype(str).unique())
        unseen = sorted(incoming_values - known_values)
        if unseen:
            unseen_categories[column] = unseen[:5]

    feature_names = preprocessor.get_feature_names_out()
    prep_ms = (time.perf_counter() - prep_start) * 1000
    preprocessing_stage = {
        "stage": "preprocessing",
        "status": "success",
        "summary": f"Imputed {missing_value_count} missing values and encoded categorical features.",
        "data": {
            "filled_missing": missing_value_count,
            "unseen_categories": unseen_categories,
            "n_features_in": len(RAW_INPUT_FEATURES),
            "n_features_out": int(len(feature_names)),
            "prep_ms": round(prep_ms, 2),
        },
    }

    prediction_start = time.perf_counter()
    probabilities = model.predict_proba(features)
    predictions = model.predict(features)
    elapsed_seconds = time.perf_counter() - prediction_start
    inference_ms = elapsed_seconds * 1000
    rows_per_second = row_count / elapsed_seconds if elapsed_seconds > 0 else 0
    confidence = np.max(probabilities, axis=1)
    class_indices = {str(class_name): index for index, class_name in enumerate(classifier.classes_)}

    prediction_stage = {
        "stage": "prediction",
        "status": "success",
        "summary": (
            f"Ran {package['model_name']} ({package['version']}) in "
            f"{inference_ms:.1f}ms ({rows_per_second:,.0f} rows/s)"
        ),
        "data": {
            "model_name": package["model_name"],
            "model_version": package["version"],
            "inference_ms": round(inference_ms, 2),
            "rows_per_second": round(rows_per_second, 1),
        },
    }

    attack_count = int(np.sum(predictions != "Normal"))
    normal_count = int(row_count - attack_count)
    low_confidence_count = int(np.sum(confidence < confidence_threshold))
    category_counts = {class_name: 0 for class_name in classes}
    for class_name, count in zip(*np.unique(predictions, return_counts=True)):
        category_counts[str(class_name)] = int(count)

    bins = ["0.0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"]
    confidence_counts = [
        int(np.sum((confidence >= 0.0) & (confidence < 0.2))),
        int(np.sum((confidence >= 0.2) & (confidence < 0.4))),
        int(np.sum((confidence >= 0.4) & (confidence < 0.6))),
        int(np.sum((confidence >= 0.6) & (confidence < 0.8))),
        int(np.sum((confidence >= 0.8) & (confidence <= 1.0))),
    ]
    results_stage = {
        "stage": "results",
        "status": "success",
        "summary": (
            f"{attack_count:,} attacks flagged ({attack_count / row_count:.1%}), "
            f"{normal_count:,} normal ({normal_count / row_count:.1%})."
        ),
        "data": {
            "total_rows": row_count,
            "attack_count": attack_count,
            "normal_count": normal_count,
            "low_confidence_count": low_confidence_count,
        },
    }

    prediction_rows = []
    for index in range(min(row_count, 1000)):
        predicted_class = str(predictions[index])
        row_features: Dict[str, Any] = {}
        for column in RAW_INPUT_FEATURES:
            value = df.iloc[index][column]
            if pd.isna(value):
                row_features[column] = None
            elif isinstance(value, (np.integer, int)):
                row_features[column] = int(value)
            elif isinstance(value, (np.floating, float)):
                row_features[column] = round(float(value), 6)
            else:
                row_features[column] = str(value)

        truth_info: Dict[str, Any] = {"has_ground_truth": False}
        if ground_truth is not None:
            actual_class = ground_truth.iloc[index]
            is_supported = actual_class in classes
            truth_info = {
                "has_ground_truth": True,
                "actual_class": actual_class,
                "is_supported": is_supported,
                "is_correct": bool(predicted_class == actual_class) if is_supported else None,
            }

        prediction_rows.append(
            {
                "row_index": index,
                "predicted_class": predicted_class,
                "model_name": package["model_name"],
                "is_attack": predicted_class != "Normal",
                "confidence": round(float(confidence[index]), 4),
                "is_low_confidence": bool(confidence[index] < confidence_threshold),
                "probabilities": {
                    class_name: round(float(probabilities[index, class_indices[class_name]]), 4)
                    for class_name in classes
                },
                "ground_truth": truth_info,
                "features": row_features,
            }
        )

    evaluation_metrics = None
    if ground_truth is not None:
        target_values = ground_truth.to_numpy()
        valid_mask = np.isin(target_values, classes)
        if np.any(valid_mask):
            y_true = target_values[valid_mask]
            y_pred = predictions[valid_mask]
            report = classification_report(
                y_true,
                y_pred,
                labels=classes,
                target_names=classes,
                output_dict=True,
                zero_division=0,
            )
            normal_actual = y_true == "Normal"
            attack_predicted = y_pred != "Normal"
            attack_actual = ~normal_actual
            normal_predicted = y_pred == "Normal"
            false_positives = int(np.sum(normal_actual & attack_predicted))
            true_negatives = int(np.sum(normal_actual & normal_predicted))
            true_positives = int(np.sum(attack_actual & ~normal_predicted))
            false_negatives = int(np.sum(attack_actual & normal_predicted))

            evaluation_metrics = {
                "has_ground_truth": True,
                "supported_rows": int(np.sum(valid_mask)),
                "excluded_rows": int(np.sum(~valid_mask)),
                "accuracy": round(float(np.mean(y_true == y_pred)), 4),
                "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
                "attack_recall": round(
                    true_positives / (true_positives + false_negatives)
                    if true_positives + false_negatives
                    else 0.0,
                    4,
                ),
                "false_alarm_rate": round(
                    false_positives / (false_positives + true_negatives)
                    if false_positives + true_negatives
                    else 0.0,
                    4,
                ),
                "per_class_metrics": {
                    class_name: {
                        "precision": round(report[class_name]["precision"], 4),
                        "recall": round(report[class_name]["recall"], 4),
                        "f1": round(report[class_name]["f1-score"], 4),
                        "support": int(report[class_name]["support"]),
                    }
                    for class_name in classes
                },
                "confusion_matrix": {
                    "classes": classes,
                    "matrix": confusion_matrix(y_true, y_pred, labels=classes).tolist(),
                },
            }

    return {
        "pipeline_stages": [
            file_stage,
            validation_stage,
            preprocessing_stage,
            prediction_stage,
            results_stage,
        ],
        "model_name": package["model_name"],
        "model_version": package["version"],
        "classes": classes,
        "summary": {
            "total_rows": row_count,
            "attack_count": attack_count,
            "normal_count": normal_count,
            "low_confidence_count": low_confidence_count,
            "category_counts": category_counts,
            "confidence_distribution": {"bins": bins, "counts": confidence_counts},
        },
        "predictions": prediction_rows,
        "evaluation_metrics": evaluation_metrics,
    }


def get_tree_structure(max_depth: int = 4) -> Dict[str, Any]:
    """Return a bounded tree topology for the fitted v3 classifier."""
    package = load_model_package()
    classifier = package["classifier"]
    feature_names = package["preprocessor"].get_feature_names_out()
    tree = classifier.tree_
    nodes: Dict[str, Dict[str, Any]] = {}

    def visit(node_id: int, depth: int) -> None:
        if depth > max_depth or node_id == -1:
            return

        is_leaf = tree.children_left[node_id] == tree.children_right[node_id]
        class_distribution = tree.value[node_id][0].tolist()
        predicted_class = str(classifier.classes_[int(np.argmax(class_distribution))])
        node = {
            "id": node_id,
            "depth": depth,
            "is_leaf": bool(is_leaf),
            "gini": round(float(tree.impurity[node_id]), 4),
            "samples": int(tree.n_node_samples[node_id]),
            "predicted_class": predicted_class,
            "class_distribution": class_distribution,
        }
        if not is_leaf:
            feature_index = int(tree.feature[node_id])
            node.update(
                {
                    "feature": str(feature_names[feature_index]),
                    "threshold": round(float(tree.threshold[node_id]), 4),
                    "left": int(tree.children_left[node_id]),
                    "right": int(tree.children_right[node_id]),
                }
            )
            visit(int(tree.children_left[node_id]), depth + 1)
            visit(int(tree.children_right[node_id]), depth + 1)
        nodes[str(node_id)] = node

    visit(0, 0)
    return {
        "max_depth": int(classifier.get_depth()),
        "total_nodes": int(tree.node_count),
        "classes": [str(class_name) for class_name in classifier.classes_],
        "root_id": 0,
        "nodes": nodes,
    }


def explain_row_prediction(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Return class probabilities and the actual decision path for one flow."""
    package = load_model_package()
    model = package["pipeline"]
    preprocessor = package["preprocessor"]
    classifier = package["classifier"]
    row = pd.DataFrame([row_dict])
    validation = validate_dataframe(row)
    if not validation["is_valid"]:
        raise ValueError(f"Missing required columns: {validation['missing_columns'][:5]}")

    features = row.loc[:, RAW_INPUT_FEATURES]
    transformed = preprocessor.transform(features)
    predictions = classifier.predict(transformed)
    probabilities = classifier.predict_proba(transformed)[0]
    predicted_class = str(predictions[0])
    class_indices = {str(name): index for index, name in enumerate(classifier.classes_)}
    probability_map = {
        class_name: round(float(probabilities[class_indices[class_name]]), 4)
        for class_name in package["classes"]
    }

    tree = classifier.tree_
    path = classifier.decision_path(transformed)
    node_indices = path.indices[path.indptr[0] : path.indptr[1]]
    transformed_row = transformed[0]
    if hasattr(transformed_row, "toarray"):
        transformed_values = transformed_row.toarray().reshape(-1)
    else:
        transformed_values = np.asarray(transformed_row).reshape(-1)
    feature_names = preprocessor.get_feature_names_out()
    path_rules = []
    path_details = []

    for path_index, node_id in enumerate(node_indices):
        is_leaf = tree.children_left[node_id] == tree.children_right[node_id]
        class_distribution = tree.value[node_id][0]
        node_class = str(classifier.classes_[int(np.argmax(class_distribution))])
        detail: Dict[str, Any] = {
            "node_id": int(node_id),
            "is_leaf": bool(is_leaf),
            "samples": int(tree.n_node_samples[node_id]),
            "gini": round(float(tree.impurity[node_id]), 4),
            "predicted_class": node_class,
        }
        if is_leaf:
            path_rules.append(f"-> Classified as {node_class}")
        else:
            feature_index = int(tree.feature[node_id])
            feature_name = str(feature_names[feature_index])
            threshold = float(tree.threshold[node_id])
            value = float(transformed_values[feature_index])
            direction = "left" if value <= threshold else "right"
            operator = "<=" if direction == "left" else ">"
            condition = f"{feature_name} {operator} {threshold:.2f}"
            next_node = int(node_indices[path_index + 1])
            path_rules.append(f"{condition} (value: {value:.2f})")
            detail.update(
                {
                    "feature": feature_name,
                    "threshold": round(threshold, 4),
                    "value": round(value, 4),
                    "direction": direction,
                    "operator": operator,
                    "condition": condition,
                    "next_node_id": next_node,
                }
            )
        path_details.append(detail)

    return {
        "model_name": package["model_name"],
        "predicted_class": predicted_class,
        "confidence": round(float(np.max(probabilities)), 4),
        "probabilities": probability_map,
        "decision_tree_path": path_rules,
        "decision_path_details": path_details,
    }
