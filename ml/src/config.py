"""NetSentinel Machine Learning Configuration.

Defines global seeds, directory paths, taxonomy, feature groupings,
strict leakage-prevention rules, and cross-validation partition strategies.
"""

from pathlib import Path
from typing import List

# ==============================================================================
# 1. Reproducibility & Global Rules
# ==============================================================================
RANDOM_SEED: int = 42

# Architectural Invariant: id must never be used as a model feature.
ID_COLUMN: str = "id"
RULE_ID_NEVER_FEATURE: str = "id is an identifier/index and must NEVER be treated as a feature."

TARGET_COLUMN: str = "attack_cat"
BINARY_TARGET_COLUMN: str = "label"

IGNORED_COLUMNS: List[str] = [ID_COLUMN, TARGET_COLUMN, BINARY_TARGET_COLUMN]

# ==============================================================================
# 2. Directory Paths
# ==============================================================================
REPO_ROOT: Path = Path(__file__).resolve().parents[2]
DATA_DIR: Path = REPO_ROOT / "data"
RAW_DATA_DIR: Path = DATA_DIR / "raw"
PROCESSED_DATA_DIR: Path = DATA_DIR / "processed"
SAMPLES_DIR: Path = DATA_DIR / "samples"

ML_DIR: Path = REPO_ROOT / "ml"
ARTIFACTS_DIR: Path = ML_DIR / "artifacts"
RESULTS_DIR: Path = ML_DIR / "results"
METRICS_DIR: Path = RESULTS_DIR / "metrics"
PLOTS_DIR: Path = RESULTS_DIR / "plots"
REPORTS_DIR: Path = RESULTS_DIR / "reports"

RAW_TRAIN_PATH: Path = RAW_DATA_DIR / "UNSW_NB15_training-set.csv"
RAW_TEST_PATH: Path = RAW_DATA_DIR / "UNSW_NB15_testing-set.csv"

CLEAN_TRAIN_PATH: Path = PROCESSED_DATA_DIR / "clean_train.csv"
CLEAN_TEST_PATH: Path = PROCESSED_DATA_DIR / "clean_test.csv"
EXPERIMENTS_LOG_PATH: Path = METRICS_DIR / "experiments_log.csv"
FINAL_METRICS_PATH: Path = METRICS_DIR / "final_metrics.json"

MODEL_ARTIFACT_PATH: Path = ARTIFACTS_DIR / "model.joblib"
METADATA_ARTIFACT_PATH: Path = ARTIFACTS_DIR / "model_metadata.json"

V3_MODEL_DIR: Path = ARTIFACTS_DIR / "v3"
V3_MODEL_ARTIFACT_PATH: Path = V3_MODEL_DIR / "final_four_class_model.joblib"
V3_METADATA_ARTIFACT_PATH: Path = V3_MODEL_DIR / "model_metadata.json"
V3_FINAL_METRICS_PATH: Path = METRICS_DIR / "v3" / "final_test_metrics.json"
V3_MODEL_NAME: str = "DecisionTreeClassifier"
V3_MODEL_VERSION: str = "v3-four-class"
V3_CLASSES: List[str] = ["Normal", "Exploits", "Fuzzers", "DoS"]

# Ensure runtime directories exist
for p in [PROCESSED_DATA_DIR, ARTIFACTS_DIR, METRICS_DIR, PLOTS_DIR, REPORTS_DIR, SAMPLES_DIR]:
    p.mkdir(parents=True, exist_ok=True)

# ==============================================================================
# 3. Class Taxonomy (6 Selected Classes)
# ==============================================================================
# Normal traffic plus top 5 representative attack categories with actionable signatures
CLASSES: List[str] = [
    "Normal",
    "Exploits",
    "Fuzzers",
    "DoS",
    "Analysis",
    "Backdoor",
]

NORMAL_CLASS: str = "Normal"

# ==============================================================================
# 4. Raw Feature Taxonomy (42 input features from UNSW-NB15)
# ==============================================================================
CATEGORICAL_FEATURES: List[str] = [
    "proto",
    "service",
    "state",
]

NUMERICAL_FEATURES: List[str] = [
    "dur",
    "spkts",
    "dpkts",
    "sbytes",
    "dbytes",
    "rate",
    "sttl",
    "dttl",
    "sload",
    "dload",
    "sloss",
    "dloss",
    "sinpkt",
    "dinpkt",
    "sjit",
    "djit",
    "swin",
    "stcpb",
    "dtcpb",
    "dwin",
    "tcprtt",
    "synack",
    "ackdat",
    "smean",
    "dmean",
    "trans_depth",
    "response_body_len",
    "ct_srv_src",
    "ct_state_ttl",
    "ct_dst_ltm",
    "ct_src_dport_ltm",
    "ct_dst_sport_ltm",
    "ct_dst_src_ltm",
    "is_ftp_login",
    "ct_ftp_cmd",
    "ct_flw_http_mthd",
    "ct_src_ltm",
    "ct_srv_dst",
    "is_sm_ips_ports",
]

RAW_INPUT_FEATURES: List[str] = CATEGORICAL_FEATURES + NUMERICAL_FEATURES

# ==============================================================================
# 5. Cross-Validation & Splitting Rules
# ==============================================================================
# Network flows arrive sequentially in bursts.
# We create row-block groups (e.g. 10 contiguous chronological blocks) for GroupKFold
# to prevent cross-session leakage / temporal data snooping.
N_CV_FOLDS: int = 5
N_BLOCK_GROUPS: int = 10
BLOCK_GROUP_COLUMN: str = "cv_group"
