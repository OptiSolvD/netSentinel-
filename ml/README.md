# NetSentinel Machine Learning Subsystem

This directory contains the data preprocessing, feature engineering, model training, cross-validation, and evaluation pipelines for the NetSentinel intrusion detection system based on the UNSW-NB15 benchmark.

---

## 1. Quick Start

### 1.1. Environment Setup
Install the pinned dependencies:
```bash
pip install -r ml/requirements.txt
```
Key packages:
- `scikit-learn==1.8.0`
- `pandas==2.3.2`
- `numpy==2.3.2`
- `joblib==1.5.3`
- `matplotlib==3.10.6`

### 1.2. Execute the Clean End-to-End Pipeline
Run the three core pipeline steps in sequence:

```bash
# 1. Preprocess raw data (drops 'id', deduplicates train data, builds CV groups)
python ml/src/preprocess.py

# 2. Run leak-free block-grouped cross validation (Dummy, DT, RF, HistGB)
python ml/src/train.py

# 3. Refit winning model and run the single official test set evaluation
python ml/src/evaluate.py
```

---

## 2. Directory Layout

```text
ml/
├── requirements.txt            <-- Pinned dependencies (scikit-learn 1.8.0)
├── README.md                   <-- This file
├── artifacts/                  <-- Generated deployment artifacts
│   ├── model.joblib            <-- Existing v1/v2 model
│   ├── model_metadata.json     <-- Existing v1/v2 model metadata
│   └── v3/                     <-- Separate four-class model and metadata
├── src/
│   ├── config.py               <-- Global constants, paths, seed=42, class list
│   ├── preprocess.py           <-- Preprocessing & deduplication engine
│   ├── features.py             <-- Network ratio features & log transforms
│   ├── train.py                <-- 5-fold GroupKFold cross-validation
│   ├── evaluate.py             <-- Official test set evaluation & artifact export
│   └── predict.py              <-- Inference & explainability engine for API
├── notebooks/
│   ├── v1/                     <-- Original project notebooks
│   ├── v2/                     <-- Leak-free clean pipeline notebooks
│   └── v3/                     <-- Consolidated Aftab experiments
│       ├── four_class/
│       │   └── improvement/
│       └── 01_preprocessing.ipynb
├── docs/
│   └── v3/                     <-- V3 reports, integration docs, and audits
│       ├── audit/
│       └── six_class_experiments/
└── results/
    ├── metrics/
    │   ├── experiments_log.csv <-- Existing cross-validation runs
    │   ├── final_metrics.json  <-- Existing test set performance JSON
    │   └── v3/                 <-- Four-class metrics and six-class history
    ├── plots/
    │   ├── confusion_matrix.png
    │   ├── feature_importance.png
    │   └── v3/                 <-- V3 and historical experiment plots
    └── reports/
        ├── data_quality_report.md
        ├── v1_failure_analysis.md
        └── evaluation_report.md
```

---

## 3. Core Architectural Rules

1. **`id` is NEVER a feature**: `id` is a sequential packet index that leaks scenario capture order. It is strictly stripped upon ingestion.
2. **Block-Grouped CV**: 10 contiguous chronological row blocks evaluated with `GroupKFold(n_splits=5)` prevent inter-session traffic snooping.
3. **Official Test Set Integrity**: The test set (`clean_test.csv`, 59,543 records) is held out unseen during hyperparameter exploration and evaluated strictly **once**.
4. **Primary vs Secondary Model**: Primary `RandomForestClassifier` (100 trees, depth 16) is deployed alongside `DecisionTreeClassifier` (depth 12) for real-time model agreement checks and decision path extraction.
