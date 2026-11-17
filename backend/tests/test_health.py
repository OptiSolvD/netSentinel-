"""Tests for NetSentinel Health and Metadata Endpoints."""

import pytest
from backend.app.main import (
    get_training_context,
    health_check,
    model_evaluation,
    model_evolution_comparison,
)


def test_health_check_unit():
    """Verifies service health check and model version telemetry."""
    data = health_check()
    assert data["status"] == "healthy"
    assert "classes" in data
    assert data["model_name"] == "DecisionTreeClassifier"
    assert data["model_version"] == "v3-four-class"
    assert data["classes"] == ["Normal", "Exploits", "Fuzzers", "DoS"]
    assert data["num_features"] == 42
    assert "scikit_learn_version" in data


def test_training_context_unit():
    """Verifies static training context endpoint."""
    data = get_training_context()
    assert data["dataset"] == "UNSW-NB15"
    assert "banner_text" in data
    assert "Trained offline" in data["banner_text"]
    assert data["winning_model"] == "DecisionTreeClassifier"
    assert len(data["models_evaluated"]) == 1
    assert data["excluded_test_classes"] == ["Analysis", "Backdoor"]
    assert data["final_test_metrics"]["false_alarm_rate"] == pytest.approx(0.23527027027027028)
    assert data["final_test_metrics"]["attack_recall"] == pytest.approx(0.920640887092985)
    assert data["final_test_metrics"]["mean_attack_class_recall"] == pytest.approx(0.5120400984706811)


def test_model_evaluation_returns_stored_four_class_report():
    """The report endpoint returns artifacts aligned with the active model taxonomy."""
    data = model_evaluation()

    assert data["source"] == "official held-out test set"
    assert data["confusion_matrix"]["classes"] == ["Normal", "Exploits", "Fuzzers", "DoS"]
    assert sum(sum(row) for row in data["confusion_matrix"]["matrix"]) == 58283
    assert [row["class_name"] for row in data["per_class_metrics"]] == data["confusion_matrix"]["classes"]
    assert sum(row["support"] for row in data["per_class_metrics"]) == 58283
    metrics = data["metrics"]
    matrix = data["confusion_matrix"]["matrix"]
    assert metrics["normal_false_alarm_rate"] == pytest.approx(1 - data["per_class_metrics"][0]["recall"])
    attack_support = sum(sum(row) for row in matrix[1:])
    pooled_attack_true_positives = sum(sum(row[1:]) for row in matrix[1:])
    assert metrics["pooled_attack_recall"] == pytest.approx(pooled_attack_true_positives / attack_support)
    assert metrics["mean_attack_class_recall"] == pytest.approx(0.5120400984706811)
    assert "normal_false_positive_rate" not in metrics


def test_model_evolution_keeps_validation_and_test_comparisons_separate():
    """Evolution data corrects validation metrics without fabricating a baseline test result."""
    data = model_evolution_comparison()

    assert data["baseline"]["validation_rows"] == 23969
    assert data["baseline"]["validation_metrics"]["normal_false_alarm_rate"] == pytest.approx(0.0859821428571429)
    assert data["official_comparison"]["status"] == "pending_baseline_artifact"
    assert data["official_comparison"]["baseline_test_metrics"] is None
    assert data["official_comparison"]["deltas"] is None

    comparison = data["validation_comparison"]
    assert comparison["evaluation_split"] == "validation"
    assert comparison["comparable"] is True
    assert comparison["challenger"]["model"] == "Random Forest tuned"
    assert comparison["challenger"]["metrics"]["normal_false_alarm_rate"] == pytest.approx(
        0.1561607142857143
    )
    assert comparison["deltas"]["macro_f1"] == pytest.approx(0.02816282284453797)
    assert comparison["deltas"]["normal_false_alarm_rate"] == pytest.approx(0.07017857142857142)

    assert data["final"]["metrics"]["normal_false_alarm_rate"] == pytest.approx(
        0.23527027027027028
    )
    assert data["final"]["metrics"]["rows"] == 58283
    assert data["final"]["metrics"]["pooled_attack_recall"] == pytest.approx(
        0.920640887092985
    )
    assert data["cross_validation_experiments"]
    assert data["cross_validation_experiments"][0]["metrics"]["normal_false_alarm_rate"] is None
    assert data["cross_validation_experiments"][0]["metrics"]["pooled_attack_recall"] is None
