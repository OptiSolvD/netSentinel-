# NetSentinel: Multi-Class Network Intrusion Detection System

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![scikit-learn 1.8.0](https://img.shields.io/badge/scikit--learn-1.8.0-orange.svg)](https://scikit-learn.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.124.4-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React-cyan.svg)](https://react.dev/)

NetSentinel is a production-grade Network Intrusion Detection System (NIDS) designed on the UNSW-NB15 benchmark dataset. It features a leak-free machine learning training pipeline, a high-throughput FastAPI inference engine with real-time 5-stage pipeline telemetry, and an interactive security operations dashboard.

---

## 1. Project Highlights

- **Leak-Free Clean Pipeline (v2)**: Completely eliminates `id` scenario leakage, drops 33,862 duplicate training flows, and employs 5-fold chronological block-grouped cross-validation.
- **6-Class Taxonomy**: Categorizes network flows into `Normal`, `Exploits`, `Fuzzers`, `DoS`, `Analysis`, and `Backdoor`.
- **High Attack Sensitivity**: Catches **95.38%** of all attacks on the official held-out test set (59,543 flows) at **69,290 rows/sec**.
- **Real Pipeline Telemetry (No Fake Animations)**: Real server execution metrics for every stepper stage (`file_received`, `validation`, `preprocessing`, `prediction`, `results`).
- **Dual-Model Real-Time Comparison**: Simultaneously runs `RandomForestClassifier` (primary) and `DecisionTreeClassifier` (secondary), computing instant agreement rates and highlighting disagreement rows.
- **Tree-Level Explainability**: Inspects Decision Tree rule paths (`sbytes <= 1200.0`, `sttl > 60.0`) and Random Forest 100-tree voting distributions on demand.

---

## 2. Repository Layout

```text
netsentinel/
├── data/
│   ├── raw/                  <-- UNSW-NB15 raw CSV files
│   ├── processed/            <-- clean_train.csv and clean_test.csv (gitignored)
│   └── samples/              <-- Pre-packaged demo CSVs (sample_traffic, sample_attacks, etc.)
├── ml/
│   ├── artifacts/            <-- model.joblib and model_metadata.json
│   ├── notebooks/            <-- v1 retrospectives and v2 clean experiment notebooks
│   ├── src/                  <-- Clean pipeline (config, preprocess, features, train, evaluate, predict)
│   └── results/              <-- final_metrics.json, plots, and markdown audit reports
├── backend/
│   ├── app/                  <-- FastAPI application (main.py)
│   ├── tests/                <-- Comprehensive test suite (11 passed tests)
│   └── requirements.txt      <-- Pinned dependencies (scikit-learn==1.8.0)
├── frontend/                 <-- React application & dashboard components
├── docs/                     <-- API contract, decisions log, exploration notes
└── README.md                 <-- Master project documentation
```

---

## 3. Quickstart & Execution Guide

### 3.1. Clone and Switch to Clean Branch
```bash
git checkout ml/clean-training
```

### 3.2. Machine Learning Pipeline Execution
To reproduce the clean training pipeline from scratch:
```bash
# 1. Preprocess raw data (drop id, deduplicate train set, assign block groups)
python ml/src/preprocess.py

# 2. Run block-grouped cross validation on baselines and candidate models
python ml/src/train.py

# 3. Refit winning model and run the single official test set evaluation
python ml/src/evaluate.py
```

### 3.3. Run Backend API Tests
```bash
python -m pytest backend/tests/
```
All 11 tests pass covering schema validation, `id` exclusion, missing columns, unseen categorical values, unlabeled traffic, and on-demand tree explanations.

### 3.4. Launch Backend API Server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI documentation will be accessible at: `http://localhost:8000/docs`.

### 3.5. Launch Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```

---

## 4. Key API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health, model version, and class list |
| `POST` | `/api/v1/validate` | Validates CSV columns against 42 expected network features |
| `POST` | `/api/v1/predict` | End-to-end inference returning 5-stage pipeline telemetry, summary, and predictions |
| `POST` | `/api/v1/explain` | On-demand single row explanation (DT decision path + RF tree votes) |
| `GET` | `/api/v1/training-context` | Static offline dataset statistics and baseline comparisons |

For full request/response schemas, refer to [docs/api_contract.md](file:///d:/netsentinel/docs/api_contract.md).
