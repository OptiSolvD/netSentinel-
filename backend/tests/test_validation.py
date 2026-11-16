"""Unit and Schema Validation Tests for NetSentinel."""

import io
import pandas as pd
import pytest

from ml.src.config import RAW_INPUT_FEATURES
from ml.src.predict import validate_dataframe


def test_validate_id_present():
    """Rule verification: When 'id' is present, it must be detected and marked as ignored."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=5)
    sample_df["id"] = [101, 102, 103, 104, 105]

    val = validate_dataframe(sample_df)
    assert val["is_valid"] is True
    assert "id" in val["ignored_columns"]
    assert len(val["missing_columns"]) == 0


def test_validate_missing_columns():
    """When required features are absent, validation must fail and list missing columns."""
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=5)
    truncated_df = sample_df.drop(columns=["proto", "sbytes"])

    val = validate_dataframe(truncated_df)
    assert val["is_valid"] is False
    assert "proto" in val["missing_columns"]
    assert "sbytes" in val["missing_columns"]


def test_validate_no_label_column():
    """Network captures in the wild have no 'label' or 'attack_cat'.

    Validation must succeed and indicate has_ground_truth is False.
    """
    sample_df = pd.read_csv("data/samples/sample_traffic.csv", nrows=5)
    unlabeled_df = sample_df.drop(columns=[c for c in ["attack_cat", "label"] if c in sample_df.columns])

    val = validate_dataframe(unlabeled_df)
    assert val["is_valid"] is True
    assert val["has_ground_truth"] is False
    assert len(val["missing_columns"]) == 0
