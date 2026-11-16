"""Data Preprocessing Pipeline for NetSentinel.

Responsibilities:
1. Load raw UNSW-NB15 training and testing CSVs.
2. Filter to the 6 target classes (Normal + 5 selected attack types).
3. Strictly enforce the rule: 'id is never a feature' by dropping it immediately.
4. Audit and drop duplicate feature records in the training set.
5. Create contiguous row-block groups for leakage-free GroupKFold cross-validation.
6. Export cleaned datasets to data/processed/ (gitignored).
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd

# Add repo root to sys.path to allow absolute imports
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.src.config import (
    CLASSES,
    CLEAN_TEST_PATH,
    CLEAN_TRAIN_PATH,
    ID_COLUMN,
    N_BLOCK_GROUPS,
    BLOCK_GROUP_COLUMN,
    RAW_INPUT_FEATURES,
    RAW_TEST_PATH,
    RAW_TRAIN_PATH,
    TARGET_COLUMN,
    BINARY_TARGET_COLUMN,
)


def load_and_filter_raw(filepath: Path) -> pd.DataFrame:
    """Load raw UNSW-NB15 dataset and filter to the 6 selected classes."""
    if not filepath.exists():
        raise FileNotFoundError(f"Raw dataset file not found: {filepath}")

    print(f"Loading raw data from {filepath}...")
    df = pd.read_csv(filepath)
    print(f"  Raw shape: {df.shape}")

    # Standardize string fields if any whitespace
    df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(str).str.strip()
    df_filtered = df[df[TARGET_COLUMN].isin(CLASSES)].copy()
    print(f"  Filtered shape ({CLASSES}): {df_filtered.shape}")
    return df_filtered


def preprocess_data():
    """Execute clean preprocessing pipeline for training and test sets."""
    # 1. Process Training Set
    train_df = load_and_filter_raw(RAW_TRAIN_PATH)

    # Architectural invariant: Drop ID column
    if ID_COLUMN in train_df.columns:
        print(f"Enforcing architectural rule: Dropping '{ID_COLUMN}' column.")
        train_df = train_df.drop(columns=[ID_COLUMN])

    # Deduplicate training set on feature columns
    # Identifying duplicates on feature columns (ignoring target/label)
    feature_cols = [c for c in train_df.columns if c not in [TARGET_COLUMN, BINARY_TARGET_COLUMN]]
    n_before = len(train_df)
    train_df = train_df.drop_duplicates(subset=feature_cols, keep="first").reset_index(drop=True)
    n_dedup = n_before - len(train_df)
    print(f"Deduplication: Dropped {n_dedup:,} duplicate rows from training set ({len(train_df):,} retained).")

    # Build chronological row-block groups for cross validation
    # Since packets were captured chronologically, contiguous chunks represent coherent temporal capture blocks.
    block_size = int(np.ceil(len(train_df) / N_BLOCK_GROUPS))
    train_df[BLOCK_GROUP_COLUMN] = (np.arange(len(train_df)) // block_size).astype(int)
    print(f"Created {N_BLOCK_GROUPS} row-block groups in column '{BLOCK_GROUP_COLUMN}'.")

    # Save cleaned training set
    train_df.to_csv(CLEAN_TRAIN_PATH, index=False)
    print(f"Saved clean training dataset to {CLEAN_TRAIN_PATH} ({train_df.shape})")

    # 2. Process Official Test Set
    test_df = load_and_filter_raw(RAW_TEST_PATH)
    if ID_COLUMN in test_df.columns:
        test_df = test_df.drop(columns=[ID_COLUMN])

    # Keep official test set distribution intact (no row dropping), save clean
    test_df.to_csv(CLEAN_TEST_PATH, index=False)
    print(f"Saved clean testing dataset to {CLEAN_TEST_PATH} ({test_df.shape})")
    print("Preprocessing complete.\n")


if __name__ == "__main__":
    preprocess_data()
