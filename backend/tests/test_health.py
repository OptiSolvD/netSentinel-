"""Tests for NetSentinel Health and Metadata Endpoints."""

import pytest
from backend.app.main import health_check, get_training_context


def test_health_check_unit():
    """Verifies service health check and model version telemetry."""
    data = health_check()
    assert data["status"] == "healthy"
    assert "classes" in data
    assert len(data["classes"]) == 6
    assert data["num_features"] == 42
    assert "scikit_learn_version" in data


def test_training_context_unit():
    """Verifies static training context endpoint."""
    data = get_training_context()
    assert data["dataset"] == "UNSW-NB15"
    assert "banner_text" in data
    assert "Trained offline" in data["banner_text"]
    assert len(data["models_evaluated"]) >= 4
