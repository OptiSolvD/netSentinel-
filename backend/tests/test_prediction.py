"""Inference and Explainability Tests for NetSentinel."""

import io
import pandas as pd
import pytest

from ml.src.predict import explain_row_prediction, predict_dataframe


def test_predict_standard_flow():
    """End-to-end prediction with full 5-stage pipeline response."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=10)
    data = predict_dataframe(sample_df, file_name="test_traffic.csv", confidence_threshold=0.60)

    assert "pipeline_stages" in data
    assert len(data["pipeline_stages"]) == 5
    assert [s["stage"] for s in data["pipeline_stages"]] == [
        "file_received",
        "validation",
        "preprocessing",
        "prediction",
        "results",
    ]

    assert "summary" in data
    assert data["summary"]["total_rows"] == 10
    assert "model_agreement_rate" in data["summary"]

    assert len(data["predictions"]) == 10
    first_row = data["predictions"][0]
    assert "predicted_class" in first_row
    assert "probabilities" in first_row
    assert len(first_row["probabilities"]) == 6
    assert "secondary_prediction" in first_row


def test_predict_with_id_present():
    """Checks that the presence of 'id' does not leak into prediction and is safely ignored."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=5)
    sample_df["id"] = [999991, 999992, 999993, 999994, 999995]

    data = predict_dataframe(sample_df, file_name="test_id.csv")
    val_stage = data["pipeline_stages"][1]
    assert "id" in val_stage["data"]["ignored_columns"]
    assert len(data["predictions"]) == 5


def test_predict_with_missing_columns():
    """Checks that missing columns returns an error response."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=5)
    bad_df = sample_df.drop(columns=["sbytes", "dbytes"])

    data = predict_dataframe(bad_df, file_name="bad_traffic.csv")
    assert "error" in data
    assert "Missing required columns" in data["error"]


def test_predict_with_unseen_categories():
    """Checks that unseen protocol or service strings do not crash inference."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=5).copy()
    sample_df["proto"] = "exotic_protocol_v9"
    sample_df["service"] = "quantum_port"
    sample_df["state"] = "ALIEN"

    data = predict_dataframe(sample_df, file_name="unseen.csv")
    assert len(data["predictions"]) == 5
    prep_stage = data["pipeline_stages"][2]
    assert "proto" in prep_stage["data"]["unseen_categories"]


def test_predict_without_label_column():
    """Unlabeled production traffic should return predictions without ground truth metrics."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=10)
    drop_cols = [c for c in ["attack_cat", "label"] if c in sample_df.columns]
    unlabeled_df = sample_df.drop(columns=drop_cols)

    data = predict_dataframe(unlabeled_df, file_name="unlabeled.csv")
    assert data["evaluation_metrics"] is None
    assert data["predictions"][0]["ground_truth"]["has_ground_truth"] is False


def test_explain_endpoint():
    """Tests on-demand row explanation with Decision Tree path and Random Forest votes."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=1)
    row_dict = sample_df.iloc[0].to_dict()

    data = explain_row_prediction(row_dict)
    assert "predicted_class" in data
    assert "confidence" in data
    assert "probabilities" in data
    assert "decision_tree_path" in data
    assert len(data["decision_tree_path"]) > 0
    assert "random_forest_votes" in data
    assert data["random_forest_votes"]["total_trees"] == 100
    assert "decision_path_details" in data
    assert len(data["decision_path_details"]) > 0
    assert "gini" in data["decision_path_details"][0]


def test_predict_single_endpoint():
    """Tests the v3 single-model inference endpoint."""
    from backend.app.main import predict_single, PredictSingleRequest

    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=1)
    row_dict = sample_df.iloc[0].to_dict()

    data = predict_single(PredictSingleRequest(features=row_dict))
    assert "prediction" in data
    assert "confidence" in data
    assert data["modelName"] == "DecisionTreeClassifier"
    assert set(data["probabilities"]) == {"Normal", "Exploits", "Fuzzers", "DoS"}
    assert "decisionPath" in data
    assert len(data["decisionPath"]) > 0


def test_tree_structure_endpoint():
    """Tests tree_structure endpoint function directly."""
    from backend.app.main import tree_structure

    data = tree_structure(depth=3)
    assert "nodes" in data
    assert "0" in data["nodes"]
    assert data["nodes"]["0"]["feature"] == "num__sttl"
    assert "gini" in data["nodes"]["0"]
