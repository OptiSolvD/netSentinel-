# NetSentinel Frontend: Intrusion Detection Dashboard

A modern React-based security dashboard for the NetSentinel Intrusion Detection System. Designed for Security Operations Center (SOC) analysts to upload network flow captures, observe real server-side pipeline telemetry, inspect multi-class predictions, compare models, and review explainability paths.

---

## 1. Core Principles

- **No Fake Progress Animations**: Every step in the 5-stage pipeline stepper renders real numbers returned from the FastAPI backend (`POST /api/v1/predict` or `POST /api/v1/validate`).
- **Dual Model Comparison**: Real-time agreement rate between the primary ensemble (`RandomForestClassifier`) and baseline interpretable tree (`DecisionTreeClassifier`).
- **Interactive Triage**: Instant filtering for Attacks Only, Disagreements Only, Low-Confidence Alerts (<60%), False Positives, and False Negatives.
- **On-Demand Row Explainability**: Clicking any row queries `POST /api/v1/explain` to display the exact Decision Tree decision path and the 100-tree Random Forest vote breakdown.

---

## 2. Page & Component Structure

```text
frontend/src/
├── App.jsx                               <-- App router & layout container
├── main.jsx                              <-- Application entry point
├── services/
│   └── api.js                            <-- Axios/Fetch client connecting to FastAPI
├── components/
│   ├── Navbar.jsx                        <-- Top navigation and offline dataset badge
│   ├── PipelineStepper.jsx               <-- 5-stage pipeline stepper (File, Validate, Prep, Predict, Results)
│   ├── SummaryCards.jsx                  <-- KPI tiles (Total rows, Attacks, Normal, Low-confidence, Agreement)
│   ├── PredictionTable.jsx               <-- Filterable, paginated table with drill-down inspector
│   ├── RowInspectorModal.jsx             <-- Probabilities bar, DT path rules, RF vote strip
│   └── Charts/
│       ├── CategoryDistribution.jsx      <-- 6-class frequency bar chart
│       ├── ConfidenceHistogram.jsx       <-- Binned prediction confidence distribution
│       └── ConfusionMatrixView.jsx       <-- Heatmap rendered when ground-truth labels exist
└── pages/
    ├── Dashboard.jsx                     <-- Main upload and interactive triage interface
    └── ModelPerformance.jsx             <-- Offline training context & benchmark metrics
```

---

## 3. How the UI Shows the Model Working

### Stage 1: File Received
- **What is displayed**: Uploaded file name, row count, column count.
- **Data source**: `pipeline_stages[0].data` (`file_name`, `rows`, `columns`).

### Stage 2: Validation
- **What is displayed**: Green badge if all 42 required network features are present. Red alert if features are missing. Warning badges for ignored columns (`id`, `label`, `attack_cat`).
- **Data source**: `pipeline_stages[1].data` (`missing_columns`, `extra_columns`, `ignored_columns`).

### Stage 3: Preprocessing
- **What is displayed**: Count of missing values imputed, unseen categorical protocols handled (e.g. `sctp_test`), and input-to-model feature count (42 raw features $\rightarrow$ 54 engineered features).
- **Data source**: `pipeline_stages[2].data` (`filled_missing`, `unseen_categories`, `n_features_in`, `n_features_out`).

### Stage 4: Prediction
- **What is displayed**: Primary model name, version (`v2.0-clean`), inference runtime in milliseconds, and throughput in rows per second.
- **Data source**: `pipeline_stages[3].data` (`primary_model`, `model_version`, `inference_ms`, `rows_per_second`).

### Stage 5: Results
- **What is displayed**: Final triage breakdown (attacks vs normal count and percentage), model agreement rate, and automatic scroll into the results dashboard.
- **Data source**: `pipeline_stages[4].data` (`attack_count`, `normal_count`, `model_agreement_rate`).

---

## 4. Getting Started

### Prerequisites
- Node.js (v18+)
- Running NetSentinel Backend at `http://localhost:8000`

### Running the App
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Pre-packaged Sample Data
Click the **"Try Sample File"** buttons on the dashboard to test pre-built files from `data/samples/`:
- `sample_traffic.csv`: 500-flow representative traffic sample
- `sample_attacks.csv`: 150 known attack flows
- `sample_normal.csv`: 150 known benign flows
- `sample_edge_cases.csv`: 60 challenging edge cases with false alarms and misses
