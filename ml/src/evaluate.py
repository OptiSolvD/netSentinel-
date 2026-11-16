"""Final Model Evaluation and Artifact Export Pipeline.

Responsibilities:
1. Selects best model architecture based on CV Macro F1 and False Alarm Rate (FAR).
2. Refits primary production model (RandomForest + Ratios) and secondary model (DecisionTree)
   on the full clean training dataset.
3. Evaluates strictly ONCE on the official UNSW-NB15 test set.
4. Computes Macro F1, Attack Recall, FAR, Per-Class metrics, Confusion Matrix, and FP/FN discrepancies.
5. Saves deployment artifacts:
   - ml/artifacts/model.joblib
   - ml/artifacts/model_metadata.json
6. Exports reports, metrics JSON, and diagnostic plots:
   - ml/results/metrics/final_metrics.json
   - ml/results/plots/confusion_matrix.png
   - ml/results/plots/feature_importance.png
7. Creates sample CSVs for backend testing and frontend demo in data/samples/:
   - sample_traffic.csv (500 rows)
   - sample_attacks.csv
   - sample_normal.csv
   - sample_edge_cases.csv
"""

import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    CLASSES,
    CLEAN_TEST_PATH,
    CLEAN_TRAIN_PATH,
    FINAL_METRICS_PATH,
    METADATA_ARTIFACT_PATH,
    MODEL_ARTIFACT_PATH,
    NORMAL_CLASS,
    PLOTS_DIR,
    RANDOM_SEED,
    RAW_INPUT_FEATURES,
    SAMPLES_DIR,
)
from ml.src.features import (
    NetworkRatioFeatureAdder,
    build_preprocessor,
    extract_features_and_target,
)
from ml.src.train import compute_intrusion_metrics


def train_and_export_final_model():
    """Trains final model, performs single test set evaluation, and exports all artifacts."""
    print("=" * 70)
    print("Starting Final Model Training & Export Pipeline")
    print("=" * 70)

    # 1. Load Datasets
    print(f"Loading training data from {CLEAN_TRAIN_PATH}...")
    df_train = pd.read_csv(CLEAN_TRAIN_PATH)
    X_train, y_train, _ = extract_features_and_target(df_train)

    print(f"Loading official test data from {CLEAN_TEST_PATH}...")
    df_test = pd.read_csv(CLEAN_TEST_PATH)
    X_test, y_test, _ = extract_features_and_target(df_test)

    print(f"  Training shape: X={X_train.shape}, y={y_train.shape}")
    print(f"  Testing shape:  X={X_test.shape}, y={y_test.shape}")

    # 2. Build Pipeline
    # Ratio preprocessor
    num_cols_with_engineered = [
        c for c in X_train.columns if c not in ["proto", "service", "state"]
    ] + [
        "sbytes_per_spkt",
        "dbytes_per_dpkt",
        "byte_ratio",
        "pkt_ratio",
        "ttl_ratio",
        "load_ratio",
        "log_dur",
        "log_sbytes",
        "log_dbytes",
        "log_rate",
        "log_sload",
        "log_dload",
    ]

    rf_preprocessor = Pipeline(
        steps=[
            ("feature_adder", NetworkRatioFeatureAdder(include_ratios=True, include_log=True)),
            ("col_transform", build_preprocessor(numerical_cols=num_cols_with_engineered)),
        ]
    )

    # Primary Model: RandomForest with Ratios
    primary_pipeline = Pipeline(
        steps=[
            ("prep", rf_preprocessor),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=100,
                    max_depth=16,
                    random_state=RANDOM_SEED,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    # Secondary Model: Interpretable Decision Tree (for comparison and decision path extraction)
    dt_preprocessor = Pipeline(
        steps=[
            ("feature_adder", NetworkRatioFeatureAdder(include_ratios=True, include_log=True)),
            ("col_transform", build_preprocessor(numerical_cols=num_cols_with_engineered)),
        ]
    )
    secondary_pipeline = Pipeline(
        steps=[
            ("prep", dt_preprocessor),
            ("clf", DecisionTreeClassifier(max_depth=12, random_state=RANDOM_SEED)),
        ]
    )

    # 3. Refit on full training set
    print("\nRefitting Primary Model (Random Forest + Ratios) on full clean training set...")
    t0 = time.time()
    primary_pipeline.fit(X_train, y_train)
    rf_fit_time = time.time() - t0
    print(f"  Primary fit completed in {rf_fit_time:.2f}s")

    print("\nRefitting Secondary Model (Decision Tree) on full clean training set...")
    t0 = time.time()
    secondary_pipeline.fit(X_train, y_train)
    dt_fit_time = time.time() - t0
    print(f"  Secondary fit completed in {dt_fit_time:.2f}s")

    # 4. Evaluate Strictly ONCE on Official Test Set
    print("\nRunning Official Test Set Evaluation (Unseen test set)...")
    t0 = time.time()
    test_preds = primary_pipeline.predict(X_test)
    test_probs = primary_pipeline.predict_proba(X_test)
    inference_time = time.time() - t0
    rows_per_sec = len(X_test) / inference_time if inference_time > 0 else 0
    print(f"  Test inference completed in {inference_time:.3f}s ({rows_per_sec:,.0f} rows/s)")

    secondary_preds = secondary_pipeline.predict(X_test)
    agreement = float(np.mean(test_preds == secondary_preds))
    print(f"  Model Agreement (Primary RF vs Secondary DT): {agreement * 100:.2f}%")

    # Compute Intrusion Metrics
    y_test_arr = y_test.to_numpy()
    overall_metrics = compute_intrusion_metrics(y_test_arr, test_preds, CLASSES)
    print(f"\nFinal Test Set Results:")
    print(f"  Accuracy:         {overall_metrics['accuracy']:.4f}")
    print(f"  Macro F1:         {overall_metrics['macro_f1']:.4f}")
    print(f"  Attack Recall:    {overall_metrics['attack_recall']:.4f}")
    print(f"  False Alarm Rate: {overall_metrics['false_alarm_rate']:.4f}")

    # Detailed Per-Class Report
    report_dict = classification_report(
        y_test_arr, test_preds, labels=CLASSES, target_names=CLASSES, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_test_arr, test_preds, labels=CLASSES)

    # Discrepancy Analysis (False Positives and False Negatives)
    is_norm_true = y_test_arr == NORMAL_CLASS
    is_atk_pred = test_preds != NORMAL_CLASS
    fp_indices = np.where(is_norm_true & is_atk_pred)[0].tolist()

    is_atk_true = y_test_arr != NORMAL_CLASS
    is_norm_pred = test_preds == NORMAL_CLASS
    fn_indices = np.where(is_atk_true & is_norm_pred)[0].tolist()

    print(f"  False Positives count: {len(fp_indices):,}")
    print(f"  False Negatives count: {len(fn_indices):,}")

    # 5. Export Plots
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(8, 6))
    cax = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    plt.title("Confusion Matrix on Official Test Set (UNSW-NB15)")
    fig.colorbar(cax)
    tick_marks = np.arange(len(CLASSES))
    plt.xticks(tick_marks, CLASSES, rotation=45)
    plt.yticks(tick_marks, CLASSES)

    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j,
                i,
                f"{cm[i, j]:,}",
                ha="center",
                va="center",
                color="white" if cm[i, j] > thresh else "black",
            )
    plt.ylabel("Actual Label")
    plt.xlabel("Predicted Label")
    plt.tight_layout()
    cm_path = PLOTS_DIR / "confusion_matrix.png"
    plt.savefig(cm_path, dpi=150)
    plt.close()
    print(f"Saved confusion matrix plot to {cm_path}")

    # Feature Importance Plot
    rf_clf = primary_pipeline.named_steps["clf"]
    prep_step = primary_pipeline.named_steps["prep"]
    col_trans = prep_step.named_steps["col_transform"]
    try:
        feature_names = col_trans.get_feature_names_out()
    except Exception:
        feature_names = [f"feat_{i}" for i in range(len(rf_clf.feature_importances_))]

    importances = rf_clf.feature_importances_
    top_indices = np.argsort(importances)[::-1][:20]
    plt.figure(figsize=(10, 6))
    plt.barh(
        [feature_names[i] for i in reversed(top_indices)],
        [importances[i] for i in reversed(top_indices)],
        color="steelblue",
    )
    plt.title("Top 20 Feature Importances (Random Forest + Ratios)")
    plt.xlabel("Gini Importance")
    plt.tight_layout()
    fi_path = PLOTS_DIR / "feature_importance.png"
    plt.savefig(fi_path, dpi=150)
    plt.close()
    print(f"Saved feature importance plot to {fi_path}")

    # 6. Export Metrics JSON
    final_results = {
        "dataset": "UNSW-NB15",
        "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_version": "v2.0-clean",
        "primary_model": "RandomForestClassifier",
        "secondary_model": "DecisionTreeClassifier",
        "scikit_learn_version": sklearn.__version__,
        "classes": CLASSES,
        "test_records": len(X_test),
        "overall_metrics": overall_metrics,
        "model_agreement_rate": round(agreement, 4),
        "per_class_metrics": {
            cls: {
                "precision": round(report_dict[cls]["precision"], 4),
                "recall": round(report_dict[cls]["recall"], 4),
                "f1_score": round(report_dict[cls]["f1-score"], 4),
                "support": int(report_dict[cls]["support"]),
            }
            for cls in CLASSES
        },
        "confusion_matrix": {
            "classes": CLASSES,
            "matrix": cm.tolist(),
        },
        "discrepancies": {
            "false_positive_count": len(fp_indices),
            "false_negative_count": len(fn_indices),
            "false_positive_sample_indices": fp_indices[:20],
            "false_negative_sample_indices": fn_indices[:20],
        },
    }

    with open(FINAL_METRICS_PATH, "w") as f:
        json.dump(final_results, f, indent=2)
    print(f"Saved final metrics JSON to {FINAL_METRICS_PATH}")

    # 7. Export Model Artifacts
    artifact_payload = {
        "primary_pipeline": primary_pipeline,
        "secondary_pipeline": secondary_pipeline,
        "classes": CLASSES,
        "raw_features": RAW_INPUT_FEATURES,
        "version": "v2.0-clean",
    }
    joblib.dump(artifact_payload, MODEL_ARTIFACT_PATH)
    print(f"Saved serialized model package to {MODEL_ARTIFACT_PATH}")

    metadata_payload = {
        "model_name": "RandomForestClassifier",
        "secondary_model": "DecisionTreeClassifier",
        "version": "v2.0-clean",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "random_seed": RANDOM_SEED,
        "scikit_learn_version": sklearn.__version__,
        "classes": CLASSES,
        "raw_features": RAW_INPUT_FEATURES,
        "num_raw_features": len(RAW_INPUT_FEATURES),
        "test_macro_f1": round(overall_metrics["macro_f1"], 4),
        "test_accuracy": round(overall_metrics["accuracy"], 4),
        "test_attack_recall": round(overall_metrics["attack_recall"], 4),
        "test_far": round(overall_metrics["false_alarm_rate"], 4),
    }
    with open(METADATA_ARTIFACT_PATH, "w") as f:
        json.dump(metadata_payload, f, indent=2)
    print(f"Saved metadata to {METADATA_ARTIFACT_PATH}")

    # 8. Create Sample CSVs in data/samples/
    print("\nGenerating Demo Sample CSVs in data/samples/...")
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

    # 500 rows representative mix
    sample_500 = df_test.sample(n=500, random_state=RANDOM_SEED).reset_index(drop=True)
    sample_500.to_csv(SAMPLES_DIR / "sample_traffic.csv", index=False)

    # Pure attacks
    attacks_subset = df_test[df_test["attack_cat"] != NORMAL_CLASS]
    sample_atk = attacks_subset.sample(n=min(150, len(attacks_subset)), random_state=RANDOM_SEED).reset_index(drop=True)
    sample_atk.to_csv(SAMPLES_DIR / "sample_attacks.csv", index=False)

    # Pure normal
    normal_subset = df_test[df_test["attack_cat"] == NORMAL_CLASS]
    sample_norm = normal_subset.sample(n=min(150, len(normal_subset)), random_state=RANDOM_SEED).reset_index(drop=True)
    sample_norm.to_csv(SAMPLES_DIR / "sample_normal.csv", index=False)

    # Ready-made edge cases (known correct, missed, and false-alarm rows)
    fp_rows = df_test.iloc[fp_indices[:20]]
    fn_rows = df_test.iloc[fn_indices[:20]]
    correct_norm_idx = np.where(is_norm_true & ~is_atk_pred)[0][:20]
    correct_norm_rows = df_test.iloc[correct_norm_idx]
    edge_cases = pd.concat([fp_rows, fn_rows, correct_norm_rows]).sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)
    edge_cases.to_csv(SAMPLES_DIR / "sample_edge_cases.csv", index=False)

    print(f"  Created sample_traffic.csv ({len(sample_500)} rows)")
    print(f"  Created sample_attacks.csv ({len(sample_atk)} rows)")
    print(f"  Created sample_normal.csv ({len(sample_norm)} rows)")
    print(f"  Created sample_edge_cases.csv ({len(edge_cases)} rows)")
    print("\nFinal evaluation and artifact export complete!\n")


if __name__ == "__main__":
    train_and_export_final_model()
