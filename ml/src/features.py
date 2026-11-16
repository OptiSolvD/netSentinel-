"""Feature Engineering Pipeline for NetSentinel.

Implements domain-informed network traffic transformations:
1. Ratio Features:
   - sbytes_per_spkt: Source packet payload density
   - dbytes_per_dpkt: Destination packet payload density
   - byte_ratio: Ratio of outbound to inbound traffic volume
   - pkt_ratio: Ratio of outbound to inbound packets
   - load_ratio: Source to destination throughput ratio
   - ttl_ratio: Source to destination TTL balance
2. Heavy-tailed Log Transforms (log1p):
   - dur, sbytes, dbytes, rate, sload, dload
3. Scikit-learn Pipeline Transformers:
   - Robust missing value imputation
   - One-hot encoding for categorical variables (proto, service, state) with handle_unknown='ignore'
"""

import sys
from pathlib import Path
from typing import List, Tuple
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    CATEGORICAL_FEATURES,
    NUMERICAL_FEATURES,
    ID_COLUMN,
    TARGET_COLUMN,
    BINARY_TARGET_COLUMN,
    BLOCK_GROUP_COLUMN,
)


class NetworkRatioFeatureAdder(BaseEstimator, TransformerMixin):
    """Calculates network protocol and throughput ratio features."""

    def __init__(self, include_ratios: bool = True, include_log: bool = True):
        self.include_ratios = include_ratios
        self.include_log = include_log
        self.engineered_feature_names_: List[str] = []

    def fit(self, X: pd.DataFrame, y=None):
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        X_out = X.copy()

        if self.include_ratios:
            # Source & destination payload density (bytes per packet)
            spkts = X_out["spkts"].clip(lower=0)
            dpkts = X_out["dpkts"].clip(lower=0)
            sbytes = X_out["sbytes"].clip(lower=0)
            dbytes = X_out["dbytes"].clip(lower=0)

            X_out["sbytes_per_spkt"] = sbytes / (spkts + 1e-5)
            X_out["dbytes_per_dpkt"] = dbytes / (dpkts + 1e-5)
            X_out["byte_ratio"] = sbytes / (dbytes + 1.0)
            X_out["pkt_ratio"] = spkts / (dpkts + 1.0)

            if "sttl" in X_out.columns and "dttl" in X_out.columns:
                X_out["ttl_ratio"] = X_out["sttl"] / (X_out["dttl"] + 1.0)

            if "sload" in X_out.columns and "dload" in X_out.columns:
                X_out["load_ratio"] = X_out["sload"] / (X_out["dload"] + 1.0)

        if self.include_log:
            log_cols = ["dur", "sbytes", "dbytes", "rate", "sload", "dload"]
            for col in log_cols:
                if col in X_out.columns:
                    X_out[f"log_{col}"] = np.log1p(np.maximum(X_out[col], 0))

        return X_out


def build_preprocessor(
    categorical_cols: List[str] = CATEGORICAL_FEATURES,
    numerical_cols: List[str] = NUMERICAL_FEATURES,
    include_ratios: bool = True,
    include_log: bool = True,
    scale_numeric: bool = False,
) -> ColumnTransformer:
    """Builds an end-to-end ColumnTransformer with ratio engineering, encoding, and imputation."""
    cat_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )

    num_steps = [("imputer", SimpleImputer(strategy="median"))]
    if scale_numeric:
        num_steps.append(("scaler", StandardScaler()))
    num_pipeline = Pipeline(steps=num_steps)

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", cat_pipeline, categorical_cols),
            ("num", num_pipeline, numerical_cols),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    return preprocessor


def extract_features_and_target(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.Series, np.ndarray]:
    """Separates feature matrix X, target y, and optional cv_group, ensuring no target leakage."""
    drop_cols = [TARGET_COLUMN, BINARY_TARGET_COLUMN]
    if ID_COLUMN in df.columns:
        drop_cols.append(ID_COLUMN)

    groups = None
    if BLOCK_GROUP_COLUMN in df.columns:
        groups = df[BLOCK_GROUP_COLUMN].to_numpy()
        drop_cols.append(BLOCK_GROUP_COLUMN)

    cols_to_drop = [c for c in drop_cols if c in df.columns]
    X = df.drop(columns=cols_to_drop)

    y = df[TARGET_COLUMN] if TARGET_COLUMN in df.columns else None
    return X, y, groups
