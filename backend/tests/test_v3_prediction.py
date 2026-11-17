"""Inference tests for the active v3 four-class model."""

import pandas as pd

from ml.src.predict_v3 import explain_row_prediction, predict_dataframe


def test_predict_uses_four_class_v3_model():
    sample = pd.read_csv("data/samples/sample_traffic.csv", nrows=5)

    result = predict_dataframe(sample, file_name="v3_sample.csv")

    assert result["model_version"] == "v3-four-class"
    assert result["classes"] == ["Normal", "Exploits", "Fuzzers", "DoS"]
    assert result["summary"]["total_rows"] == 5
    assert len(result["predictions"]) == 5
    for prediction in result["predictions"]:
        assert set(prediction["probabilities"]) == set(result["classes"])
        assert "secondary_prediction" not in prediction
        assert abs(sum(prediction["probabilities"].values()) - 1) < 0.001


def test_prediction_excludes_unsupported_ground_truth_labels():
    sample = pd.read_csv("data/samples/sample_traffic.csv", nrows=3)
    sample.loc[0, "attack_cat"] = "Analysis"

    result = predict_dataframe(sample)

    assert result["evaluation_metrics"]["excluded_rows"] == 1
    assert result["predictions"][0]["ground_truth"]["is_supported"] is False
    assert result["predictions"][0]["ground_truth"]["is_correct"] is None


def test_explanation_returns_fitted_tree_path():
    sample = pd.read_csv("data/samples/sample_traffic.csv", nrows=1)

    explanation = explain_row_prediction(sample.iloc[0].to_dict())

    assert explanation["model_name"] == "DecisionTreeClassifier"
    assert explanation["predicted_class"] in {"Normal", "Exploits", "Fuzzers", "DoS"}
    assert explanation["decision_path_details"]
    assert explanation["decision_path_details"][-1]["is_leaf"] is True
    assert "random_forest_votes" not in explanation
