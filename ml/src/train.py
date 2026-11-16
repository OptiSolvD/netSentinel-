"""Training and Cross-Validation Pipeline for NetSentinel.

Runs leak-free block-grouped cross-validation across baseline and candidate models:
1. DummyClassifier (Zero-intelligence baseline)
2. DecisionTreeClassifier (Interpretable baseline)
3. RandomForestClassifier (Ensemble baseline)
4. HistGradientBoostingClassifier (Modern gradient boosted trees)

Logs all experiment iterations to ml/results/metrics/experiments_log.csv.
"""

import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import classification_report, f1_score, confusion_matrix
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    CLASSES,
    CLEAN_TRAIN_PATH,
    EXPERIMENTS_LOG_PATH,
    N_CV_FOLDS,
    NORMAL_CLASS,
    RANDOM_SEED,
)
from ml.src.features import (
    NetworkRatioFeatureAdder,
    build_preprocessor,
    extract_features_and_target,
)


def compute_intrusion_metrics(
    y_true: np.ndarray, y_pred: np.ndarray, classes: List[str]
) -> Dict[str, float]:
    """Computes Macro F1, Per-class metrics, Attack Recall, and False Alarm Rate (FAR)."""
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    accuracy = float(np.mean(y_true == y_pred))

    # Binary categorization: Normal vs Attack
    is_normal_true = y_true == NORMAL_CLASS
    is_attack_true = ~is_normal_true

    is_normal_pred = y_pred == NORMAL_CLASS
    is_attack_pred = ~is_normal_pred

    # False Alarm Rate = (Predicted Attack when Actually Normal) / (Total Actually Normal)
    fp = np.sum(is_normal_true & is_attack_pred)
    tn = np.sum(is_normal_true & is_normal_pred)
    far = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0

    # Attack Recall = (Predicted Attack when Actually Attack) / (Total Actually Attack)
    tp = np.sum(is_attack_true & is_attack_pred)
    fn = np.sum(is_attack_true & is_normal_pred)
    attack_recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0

    return {
        "macro_f1": macro_f1,
        "accuracy": accuracy,
        "attack_recall": attack_recall,
        "false_alarm_rate": far,
    }


def evaluate_model_grouped_cv(
    model_name: str,
    pipeline: Pipeline,
    X: pd.DataFrame,
    y: pd.Series,
    groups: np.ndarray,
    n_splits: int = N_CV_FOLDS,
) -> Dict[str, float]:
    """Evaluates a model pipeline using GroupKFold across chronological row-block groups."""
    gkf = GroupKFold(n_splits=n_splits)
    macro_f1s, accs, recalls, fars, times = [], [], [], [], []

    print(f"\n--- Evaluating {model_name} (GroupKFold, k={n_splits}) ---")
    fold = 1
    for train_idx, val_idx in gkf.split(X, y, groups=groups):
        X_tr, y_tr = X.iloc[train_idx], y.iloc[train_idx]
        X_va, y_val = X.iloc[val_idx], y.iloc[val_idx]

        t0 = time.time()
        pipeline.fit(X_tr, y_tr)
        t_fit = time.time() - t0

        y_va_pred = pipeline.predict(X_va)
        metrics = compute_intrusion_metrics(y_val.to_numpy(), y_va_pred, CLASSES)

        macro_f1s.append(metrics["macro_f1"])
        accs.append(metrics["accuracy"])
        recalls.append(metrics["attack_recall"])
        fars.append(metrics["false_alarm_rate"])
        times.append(t_fit)

        print(
            f"  Fold {fold}: Macro F1 = {metrics['macro_f1']:.4f} | "
            f"FAR = {metrics['false_alarm_rate']:.4f} | "
            f"Attack Recall = {metrics['attack_recall']:.4f} ({t_fit:.1f}s)"
        )
        fold += 1

    summary = {
        "model_name": model_name,
        "cv_macro_f1_mean": float(np.mean(macro_f1s)),
        "cv_macro_f1_std": float(np.std(macro_f1s)),
        "cv_accuracy_mean": float(np.mean(accs)),
        "cv_attack_recall_mean": float(np.mean(recalls)),
        "cv_far_mean": float(np.mean(fars)),
        "avg_fit_seconds": float(np.mean(times)),
    }
    print(
        f"==> {model_name} Results: Macro F1: {summary['cv_macro_f1_mean']:.4f} +/- {summary['cv_macro_f1_std']:.4f} | "
        f"FAR: {summary['cv_far_mean']:.4f} | Recall: {summary['cv_attack_recall_mean']:.4f}"
    )
    return summary


def log_experiment(record: Dict):
    """Appends an experiment result to ml/results/metrics/experiments_log.csv."""
    EXPERIMENTS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    df_record = pd.DataFrame([record])
    if not EXPERIMENTS_LOG_PATH.exists():
        df_record.to_csv(EXPERIMENTS_LOG_PATH, index=False)
    else:
        df_record.to_csv(EXPERIMENTS_LOG_PATH, mode="a", header=False, index=False)
    print(f"Logged experiment to {EXPERIMENTS_LOG_PATH}")


def run_baseline_experiments():
    """Runs baseline block-grouped CV for Dummy, DecisionTree, and RandomForest."""
    if not CLEAN_TRAIN_PATH.exists():
        raise FileNotFoundError(f"Clean training data not found at {CLEAN_TRAIN_PATH}. Run preprocess.py first.")

    df_train = pd.read_csv(CLEAN_TRAIN_PATH)
    X, y, groups = extract_features_and_target(df_train)

    base_preprocessor = build_preprocessor(include_ratios=False, include_log=False)
    ratio_preprocessor = Pipeline(
        steps=[
            ("feature_adder", NetworkRatioFeatureAdder(include_ratios=True, include_log=True)),
            (
                "col_transform",
                build_preprocessor(
                    numerical_cols=[
                        c
                        for c in X.columns
                        if c not in ["proto", "service", "state"]
                    ]
                    + [
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
                ),
            ),
        ]
    )

    experiments = [
        (
            "Dummy (Stratified)",
            Pipeline(
                steps=[
                    ("prep", base_preprocessor),
                    ("clf", DummyClassifier(strategy="stratified", random_state=RANDOM_SEED)),
                ]
            ),
            "Baseline majority/stratified dummy without leak",
        ),
        (
            "DecisionTree (Depth 12)",
            Pipeline(
                steps=[
                    ("prep", base_preprocessor),
                    ("clf", DecisionTreeClassifier(max_depth=12, random_state=RANDOM_SEED)),
                ]
            ),
            "Baseline DT (honest, id dropped, block CV)",
        ),
        (
            "RandomForest (100 trees, Depth 16)",
            Pipeline(
                steps=[
                    ("prep", base_preprocessor),
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
            ),
            "Baseline RF (honest, id dropped, block CV)",
        ),
        (
            "RandomForest + Ratios",
            Pipeline(
                steps=[
                    ("prep", ratio_preprocessor),
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
            ),
            "RF with engineered ratio features & log transforms",
        ),
        (
            "HistGradientBoosting + Ratios",
            Pipeline(
                steps=[
                    ("prep", ratio_preprocessor),
                    (
                        "clf",
                        HistGradientBoostingClassifier(
                            max_iter=100,
                            max_depth=12,
                            random_state=RANDOM_SEED,
                        ),
                    ),
                ]
            ),
            "HistGradientBoosting with ratio features & log transforms",
        ),
    ]

    for model_name, pipeline, notes in experiments:
        res = evaluate_model_grouped_cv(model_name, pipeline, X, y, groups)
        record = {
            "timestamp": datetime.now().isoformat(),
            "model_name": model_name,
            "cv_splits": N_CV_FOLDS,
            "cv_macro_f1_mean": round(res["cv_macro_f1_mean"], 4),
            "cv_macro_f1_std": round(res["cv_macro_f1_std"], 4),
            "cv_accuracy_mean": round(res["cv_accuracy_mean"], 4),
            "cv_attack_recall_mean": round(res["cv_attack_recall_mean"], 4),
            "cv_far_mean": round(res["cv_far_mean"], 4),
            "avg_fit_seconds": round(res["avg_fit_seconds"], 2),
            "notes": notes,
        }
        log_experiment(record)


if __name__ == "__main__":
    run_baseline_experiments()
