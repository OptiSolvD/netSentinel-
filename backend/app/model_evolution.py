"""Build a provenance-aware view of the four-class model experiments."""

import json
from typing import Any, Dict, List

import pandas as pd

from ml.src.config import (
    METADATA_ARTIFACT_PATH,
    V3_FINAL_METRICS_PATH,
    V3_MODEL_DIR,
)


def _metrics_from_confusion_matrix(
    matrix: List[List[int]],
    classes: List[str],
) -> Dict[str, Any]:
    if len(matrix) != len(classes) or any(len(row) != len(classes) for row in matrix):
        raise ValueError("An experiment confusion matrix does not match the four-class schema.")

    row_supports = [sum(row) for row in matrix]
    column_supports = [
        sum(matrix[row_index][column_index] for row_index in range(len(classes)))
        for column_index in range(len(classes))
    ]
    class_metrics = []
    for index, class_name in enumerate(classes):
        true_positive = matrix[index][index]
        precision = true_positive / column_supports[index] if column_supports[index] else 0.0
        recall = true_positive / row_supports[index] if row_supports[index] else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        class_metrics.append(
            {
                "class_name": class_name,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "support": row_supports[index],
            }
        )

    total = sum(row_supports)
    if not total:
        raise ValueError("An experiment confusion matrix contains no evaluated rows.")

    normal_index = classes.index("Normal")
    attack_indices = [index for index, name in enumerate(classes) if name != "Normal"]
    attack_support = sum(row_supports[index] for index in attack_indices)
    return {
        "rows": total,
        "accuracy": sum(matrix[index][index] for index in range(len(classes))) / total,
        "macro_f1": sum(row["f1"] for row in class_metrics) / len(classes),
        "weighted_f1": sum(row["f1"] * row["support"] for row in class_metrics) / total,
        "normal_false_alarm_rate": (
            1 - class_metrics[normal_index]["recall"]
            if row_supports[normal_index]
            else 0.0
        ),
        "pooled_attack_recall": (
            sum(
                matrix[actual_index][predicted_index]
                for actual_index in attack_indices
                for predicted_index in attack_indices
            ) / attack_support
            if attack_support
            else 0.0
        ),
        "mean_attack_class_recall": (
            sum(class_metrics[index]["recall"] for index in attack_indices) / len(attack_indices)
        ),
        "per_class_metrics": class_metrics,
    }


def _parse_json_object(value: Any) -> Dict[str, Any]:
    if not isinstance(value, str) or not value.strip():
        return {}
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("An experiment configuration is not a JSON object.")
    return parsed


def _validation_experiment(
    row: pd.Series,
    classes: List[str],
    experiment_id: str,
    source: str,
) -> Dict[str, Any]:
    raw_matrix = row.get("confusion_matrix")
    if not isinstance(raw_matrix, str) or not raw_matrix.strip():
        raise ValueError(f"{experiment_id} has no saved validation confusion matrix.")
    matrix = [[int(value) for value in values] for values in json.loads(raw_matrix)]
    metrics = _metrics_from_confusion_matrix(matrix, classes)
    recommendation = str(row.get("recommendation", "") or "")
    reason = str(row.get("reason", "") or "")
    phase = str(row.get("phase", "validation"))

    if recommendation.upper() == "KEEP":
        selection_status = "Baseline retained for final refit"
    elif metrics["normal_false_alarm_rate"] > 0.10:
        selection_status = "Compared; exceeds the 10% validation FAR preference"
    else:
        selection_status = "Compared; not selected for final serving"

    return {
        "experiment_id": experiment_id,
        "model": str(row["model"]),
        "algorithm": str(row["model"]).replace(" tuned", ""),
        "phase": phase,
        "evaluation_split": "validation",
        "source": source,
        "configuration": _parse_json_object(row.get("configuration", row.get("parameters", ""))),
        "metrics": metrics,
        "confusion_matrix": {"classes": classes, "matrix": matrix},
        "recommendation": recommendation or None,
        "reason": reason or None,
        "selection_status": selection_status,
    }


def _load_experiments(classes: List[str]) -> Dict[str, Any]:
    metrics_dir = V3_FINAL_METRICS_PATH.parent
    comparison_path = metrics_dir / "model_comparison.csv"
    improvement_path = metrics_dir / "improvement" / "improvement_comparison.csv"
    cross_validation_path = metrics_dir / "improvement" / "cross_validation_results.csv"

    comparison_frame = pd.read_csv(comparison_path)
    improvement_frame = pd.read_csv(improvement_path)
    cross_validation_frame = pd.read_csv(cross_validation_path)

    experiments = []
    for index, row in comparison_frame.iterrows():
        experiments.append(
            _validation_experiment(
                row,
                classes,
                f"four-class-{row['phase']}-{index + 1}",
                "model_comparison.csv",
            )
        )

    for index, row in improvement_frame.iterrows():
        if str(row.get("candidate", "")).lower() == "historical":
            continue
        experiments.append(
            _validation_experiment(
                row,
                classes,
                f"improvement-{row['candidate']}-{index + 1}",
                "improvement_comparison.csv",
            )
        )

    cross_validation = []
    for _, row in cross_validation_frame.iterrows():
        cross_validation.append(
            {
                "experiment_id": f"cv-candidate-{row['candidate']}",
                "candidate": str(row["candidate"]),
                "model": str(row["model"]),
                "evaluation_split": "grouped cross-validation",
                "configuration": _parse_json_object(row.get("parameters", "")),
                "metrics": {
                    "accuracy": float(row["cv_accuracy"]),
                    "macro_f1": float(row["cv_macro_f1"]),
                    "weighted_f1": float(row["cv_weighted_f1"]),
                    "normal_false_alarm_rate": None,
                    "pooled_attack_recall": None,
                    "mean_attack_class_recall": None,
                    "class_recalls": {
                        "DoS": float(row["cv_DoS_recall"]),
                        "Fuzzers": float(row["cv_Fuzzers_recall"]),
                    },
                },
                "cv_seconds": float(row["cv_seconds"]),
                "metric_note": (
                    "The saved CV FAR and attack_recall columns use incorrect formulas. "
                    "Fold confusion matrices were not retained, so those metrics cannot be corrected."
                ),
            }
        )

    return {
        "validation_experiments": experiments,
        "cross_validation_experiments": cross_validation,
        "cross_validation_note": (
            "The saved results report two-fold grouped CV on a fit-only sample; fold-level "
            "confusion matrices and score standard deviations are not available."
        ),
    }


def build_model_evolution_report(
    package: Dict[str, Any],
    evaluation: Dict[str, Any],
) -> Dict[str, Any]:
    """Combine saved model metadata and experiment records without mixing splits."""
    classes = package["classes"]
    experiment_data = _load_experiments(classes)
    validation_experiments = experiment_data["validation_experiments"]

    baseline_matches = [
        experiment
        for experiment in validation_experiments
        if experiment["model"] == "Decision Tree" and experiment["phase"] == "baseline"
    ]
    if not baseline_matches:
        raise ValueError("The four-class Decision Tree validation baseline record is missing.")
    baseline = baseline_matches[0]

    challengers = [
        experiment
        for experiment in validation_experiments
        if experiment["experiment_id"] != baseline["experiment_id"]
    ]
    best_macro_challenger = max(
        challengers,
        key=lambda experiment: experiment["metrics"]["macro_f1"],
    )
    same_validation_support = (
        baseline["metrics"]["per_class_metrics"]
        and [
            row["support"] for row in baseline["metrics"]["per_class_metrics"]
        ] == [
            row["support"] for row in best_macro_challenger["metrics"]["per_class_metrics"]
        ]
    )
    validation_deltas = None
    validation_class_comparison = None
    if same_validation_support:
        metric_names = (
            "accuracy",
            "macro_f1",
            "weighted_f1",
            "normal_false_alarm_rate",
            "pooled_attack_recall",
        )
        validation_deltas = {
            name: best_macro_challenger["metrics"][name] - baseline["metrics"][name]
            for name in metric_names
        }
        validation_class_comparison = []
        for baseline_class, challenger_class in zip(
            baseline["metrics"]["per_class_metrics"],
            best_macro_challenger["metrics"]["per_class_metrics"],
        ):
            validation_class_comparison.append(
                {
                    "class_name": baseline_class["class_name"],
                    "support": baseline_class["support"],
                    "baseline": baseline_class,
                    "challenger": challenger_class,
                    "recall_delta": challenger_class["recall"] - baseline_class["recall"],
                }
            )

    metadata = package["metadata"]
    classifier = package["classifier"]
    final_metrics = dict(evaluation["metrics"])
    final_metrics["rows"] = int(final_metrics["test_rows_evaluated"])
    preprocessing = {
        "numeric": "Median imputation",
        "categorical": "Most-frequent imputation, then one-hot encoding",
        "unknown_categories": "Ignored by the fitted encoder",
        "transformed_feature_count": int(len(package["preprocessor"].get_feature_names_out())),
    }
    baseline_model_path = V3_MODEL_DIR / "baseline_four_class_model.joblib"
    try:
        with METADATA_ARTIFACT_PATH.open(encoding="utf-8") as metadata_file:
            legacy_metadata = json.load(metadata_file)
    except FileNotFoundError:
        legacy_metadata = {}

    final_model = {
        "name": classifier.__class__.__name__,
        "algorithm": classifier.__class__.__name__,
        "version": package["version"],
        "artifact_available": True,
        "feature_count": len(metadata["predictors"]),
        "features": metadata["predictors"],
        "parameters": classifier.get_params(deep=False),
        "preprocessing": preprocessing,
        "dataset": "UNSW-NB15 four-class training partition",
        "training_rows": int(metadata["training_rows"]),
        "metrics": final_metrics,
        "per_class_metrics": evaluation["per_class_metrics"],
        "confusion_matrix": evaluation["confusion_matrix"],
        "selection_reason": baseline["reason"],
    }
    baseline_model = {
        "name": "Baseline Decision Tree",
        "algorithm": "DecisionTreeClassifier",
        "version": "four-class validation baseline",
        "artifact_available": baseline_model_path.is_file(),
        "feature_count": len(metadata["predictors"]),
        "features": metadata["predictors"],
        "parameters": classifier.get_params(deep=False),
        "recorded_configuration": baseline["configuration"],
        "preprocessing": preprocessing,
        "dataset": "UNSW-NB15 four-class fit/validation split",
        "validation_rows": baseline["metrics"]["rows"],
        "training_rows": 95872,
        "validation_metrics": baseline["metrics"],
        "validation_confusion_matrix": baseline["confusion_matrix"],
        "validation_reason": baseline["reason"],
    }

    legacy_classes = legacy_metadata.get("classes", [])
    legacy_comparison_note = (
        f"The existing v2 artifact has {len(legacy_classes)} classes and cannot serve as a four-class baseline."
        if legacy_classes
        else "The existing v2 artifact metadata could not be read and cannot be verified as a four-class baseline."
    )
    official_comparison = {
        "status": "pending_baseline_artifact",
        "comparable": False,
        "baseline_test_metrics": None,
        "final_test_metrics": final_metrics,
        "deltas": None,
        "reason": (
            "No separate four-class baseline model artifact or baseline official-test "
            f"predictions are present. {legacy_comparison_note} "
            "The saved baseline results are validation-only; cross-split deltas are not shown."
        ),
    }

    top_errors = []
    matrix = evaluation["confusion_matrix"]["matrix"]
    for actual_index, actual_class in enumerate(classes):
        for predicted_index, predicted_class in enumerate(classes):
            if actual_index != predicted_index and matrix[actual_index][predicted_index]:
                top_errors.append(
                    {
                        "actual_class": actual_class,
                        "predicted_class": predicted_class,
                        "count": matrix[actual_index][predicted_index],
                    }
                )
    top_errors.sort(key=lambda item: item["count"], reverse=True)

    validation_comparison = {
        "evaluation_split": "validation",
        "rows": baseline["metrics"]["rows"],
        "baseline": baseline,
        "challenger": best_macro_challenger,
        "deltas": validation_deltas,
        "per_class": validation_class_comparison,
        "comparable": bool(same_validation_support),
        "note": (
            "This is a validation-only comparison between models evaluated on the same "
            "four-class validation rows; it is not the final official-test comparison."
        ),
    }

    stages = [
        {
            "stage": "Baseline development",
            "summary": (
                "An unweighted Decision Tree with random_state=42 established the "
                "four-class validation reference."
            ),
            "metrics": baseline["metrics"],
        },
        {
            "stage": "Alternative model experiments",
            "summary": (
                f"{len(validation_experiments)} recorded validation candidates cover "
                "Decision Tree, Random Forest, HistGradientBoosting, and XGBoost."
            ),
            "experiments": validation_experiments,
        },
        {
            "stage": "Feature engineering",
            "summary": (
                "No derived ratio/log features or feature-selection step is recorded in "
                "the four-class pipeline. The selected model retains the 42 raw predictors."
            ),
            "retained_feature_count": len(metadata["predictors"]),
            "preprocessing": preprocessing,
        },
        {
            "stage": "Hyperparameter tuning",
            "summary": experiment_data["cross_validation_note"],
            "cross_validation_experiments": experiment_data["cross_validation_experiments"],
        },
        {
            "stage": "Error analysis",
            "summary": (
                "Official-test per-class metrics and the confusion matrix identify "
                "class-specific misses; no baseline official-test matrix is available."
            ),
            "per_class_metrics": evaluation["per_class_metrics"],
            "largest_test_errors": top_errors[:6],
        },
        {
            "stage": "Final model selection",
            "summary": (
                "The original Decision Tree configuration was retained because it met "
                "the predeclared validation FAR preference; higher-macro-F1 candidates "
                "exceeded that preference. The final model is a refit on all eligible training rows."
            ),
            "model": final_model,
            "validation_reason": baseline["reason"],
        },
    ]

    return {
        "classes": classes,
        "baseline": baseline_model,
        "final": final_model,
        "official_comparison": official_comparison,
        "validation_comparison": validation_comparison,
        "validation_experiments": validation_experiments,
        "cross_validation_experiments": experiment_data["cross_validation_experiments"],
        "cross_validation_note": experiment_data["cross_validation_note"],
        "evolution_stages": stages,
        "data_quality_notes": [
            (
                "The final four-class model is the baseline Decision Tree configuration "
                f"refit on {int(metadata['training_rows']):,} eligible training rows; "
                "it is not a separately optimized algorithm."
            ),
            "Historical improvement CSV FAR and attack_recall fields are recalculated from saved validation confusion matrices. CV FAR/attack-recall fields are omitted because fold matrices were not saved.",
            "The current improvement notebook source and saved CV candidate records do not fully agree; treat saved CV scores as recorded history, not a fully reproducible rerun.",
            evaluation["metric_note"],
        ],
    }
