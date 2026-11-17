# NetSentinel – Multi-Class Network Intrusion Detection System

NetSentinel is a machine-learning-based Network Intrusion Detection System (NIDS) built using the UNSW-NB15 benchmark dataset. It analyzes network-flow records and classifies traffic into four supported categories: **Normal, Exploits, Fuzzers, and DoS**.

The project combines a machine-learning pipeline, a FastAPI inference backend, and a React dashboard. Users can upload CSV traffic data, inspect predictions and evaluation results, explore the trained Decision Tree, and review model-development information.

---

## Live Application

- **Frontend:** [NetSentinel Web Application](https://optisolvd.github.io/netSentinel-/)
- **Backend API:** https://netsentinel-api-zvqk.onrender.com
- **API documentation:** https://netsentinel-api-zvqk.onrender.com/docs
- **Repository:** https://github.com/OptiSolvD/netSentinel-

## 1. Application Features

### 1.1 Overview

Introduces NetSentinel, its purpose, supported traffic categories, and the active model.

### 1.2 How It Works

Explains the processing workflow: CSV input, feature preparation, model inference, and presentation of classification results.

### 1.3 Test & Evaluate

Allows a user to upload a CSV file and submit its network-flow records to the backend for classification.

The workflow supports:
- CSV upload and input validation.
- Prediction of records into the four supported classes.
- Prediction summaries and confidence information returned by the model.
- Evaluation metrics when the uploaded file includes supported ground-truth labels.
- Pre-collected demonstration CSV files stored in `demo_uploads/`.

The three prepared demonstration files are:
- `demo_normal.csv` – Normal traffic records only.
- `demo_attacks.csv` – Exploits, Fuzzers, and DoS records.
- `demo_mixed_traffic.csv` – A mixture of all four supported classes.

These files are intended to make the upload-and-prediction workflow easy to demonstrate without requiring a live network capture.

### 1.4 Live Traffic

The application includes a Live Traffic section representing the planned real-time monitoring workflow. Direct packet capture and continuous live traffic monitoring are not currently implemented. The current implemented workflow is based on uploaded CSV network-flow records.

### 1.5 Reports

Presents the model's stored evaluation/report information separately from results generated for an individual uploaded CSV. The benchmark report should be regenerated after changing the testing partition; it should not continue displaying metrics calculated on the previous full testing file.

### 1.6 Model Evolution

Presents model-development and comparison information so users can understand the model-selection and experimentation process.

### 1.7 Decision Tree Visualization

Provides an interactive, level-wise view of the trained Decision Tree. Users can explore branches progressively instead of rendering the complete tree at once.

Node information includes:
- Splitting feature and threshold.
- Number of training samples.
- Gini impurity.
- Predicted class for leaf nodes.

Users can expand and collapse branches to inspect the model's decision structure.

## 2. Supported Classification Categories

The active model is a four-class classifier:

| Class | Description |
|---|---|
| Normal | Legitimate network traffic |
| Exploits | Traffic associated with exploitation attempts |
| Fuzzers | Traffic generated through fuzzing techniques |
| DoS | Denial-of-Service traffic |

The classifier uses **42 network-flow predictor features**. The `id` field and target/ground-truth fields such as `attack_cat` and `label` must not be passed to the model as predictor inputs.

The original UNSW-NB15 data contains additional categories, including Analysis and Backdoor. These categories are outside the active model's four-class output scope and are excluded from the prepared demo upload files.

## 3. Repository Structure

The main project structure is:

```text
netSentinel-/
├── backend/
│   ├── app/
│   ├── tests/
│   └── requirements.txt
├── data/
│   ├── raw/
│   ├── processed/
│   │   ├── clean_test.csv
│   │   ├── clean_train.csv
│   │   ├── selected_testing.csv
│   │   └── selected_training.csv
│   └── samples/
├── demo_uploads/
│   ├── demo_attacks.csv
│   ├── demo_mixed_traffic.csv
│   └── demo_normal.csv
├── docs/
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── ml/
│   ├── artifacts/
│   ├── notebooks/
│   ├── src/
│   └── results/
├── .env.example
├── .gitignore
└── README.md
```

### Directory and data-file descriptions

| Path | Purpose |
|---|---|
| `backend/` | FastAPI application, inference endpoints, validation logic, and backend tests. |
| `frontend/` | React/Vite application, pages, dashboard components, and public assets. |
| `data/raw/` | Raw source datasets. |
| `data/processed/` | Cleaned and prepared datasets used by the machine-learning workflow. |
| `data/processed/clean_train.csv` | Cleaned training data. |
| `data/processed/clean_test.csv` | Cleaned testing data. |
| `data/processed/selected_training.csv` | Selected training dataset used by the project pipeline. |
| `data/processed/selected_testing.csv` | Current benchmark testing partition used for the refreshed evaluation. |
| `demo_uploads/` | Ready-to-upload CSV files at the repository root for demonstrating the four-class prediction workflow. |
| `data/samples/` | Existing sample CSV files used by the application's sample-data workflow. |
| `ml/` | Preprocessing, training, evaluation, prediction code, model artifacts, notebooks, and results. |
| `docs/` | Project documentation and API contract information. |

The root-level `demo_uploads/` directory is separate from `data/samples/`: `demo_uploads/` contains the prepared demonstration datasets created from the reserved testing partition, while `data/samples/` contains the project's existing sample data.

## 4. Testing and Demonstration Data

### 4.1 Testing-data partition

The original `selected_testing.csv` was split using stratified sampling by `attack_cat`, with random seed `42`. Approximately 10% of each category was reserved for demonstration, and the remaining records were saved as the new `data/processed/selected_testing.csv`.

| Partition | Records | Purpose |
|---|---:|---|
| Remaining benchmark partition | 53,589 | Input to the refreshed evaluation script |
| Reserved partition | 5,954 | Source for demonstration CSVs |
| Original dataset | 59,543 | Dataset before the split |

The split was performed across the categories present in the source file. The remaining benchmark partition therefore still contains Analysis and Backdoor rows. The evaluation pipeline must apply the model's four-class filter before calculating the active model's four-class metrics.

### 4.2 Four-class evaluation subset

After filtering the new `selected_testing.csv` to Normal, Exploits, Fuzzers, and DoS, the evaluation subset contains **52,455 records**.

| Class | Records in refreshed benchmark subset |
|---|---:|
| Normal | 33,300 |
| Exploits | 10,019 |
| Fuzzers | 5,456 |
| DoS | 3,680 |
| **Total** | **52,455** |

The remaining 1,134 records in the benchmark partition belong to Analysis or Backdoor and are not part of the active four-class evaluation.

### 4.3 Demonstration CSV files

The reserved partition contains 5,954 records. The three files in the root-level `demo_uploads/` directory contain only the four classes supported by the active model:

| File | Included classes | Records |
|---|---|---:|
| `demo_normal.csv` | Normal | 3,700 |
| `demo_attacks.csv` | Exploits, Fuzzers, DoS | 2,128 |
| `demo_mixed_traffic.csv` | Normal, Exploits, Fuzzers, DoS | 5,828 |

The reserved partition also contained 126 Analysis and Backdoor records. These were excluded from the three four-class demo files.

**Important evaluation note:** The reserved demonstration records came from the original testing dataset, which had previously been evaluated as a whole. The refreshed benchmark metrics are calculated on the remaining partition after reserving demo records. This should be described accurately; the reserved records are not a completely untouched test set.

### 4.4 Uploading a demonstration file

1. Start or open the NetSentinel web application.
2. Navigate to **Test & Evaluate**.
3. Select one of the CSV files from the repository's root-level `demo_uploads/` directory.
4. Upload and submit the file.
5. Review the returned predictions and available summaries.

The CSV files retain ground-truth columns where present. For inference, the backend must use only the 42 expected predictor features. `id`, `attack_cat`, and `label` are not model input features. Ground-truth columns may be used separately for evaluation when the upload/evaluation workflow supports them.

### 4.5 Uploading another dataset

A user-provided CSV should contain the 42 expected model features. For labelled evaluation, it should also contain `attack_cat` with labels from the four supported categories. Missing or incompatible feature columns may cause validation errors.

## 5. Evaluation Metrics

When ground-truth labels are available, NetSentinel compares the actual categories with the model's predictions.

| Metric | Description |
|---|---|
| Accuracy | Percentage of records classified correctly. |
| Precision | Proportion of predictions for a class that are correct. |
| Recall | Proportion of actual records of a class that are detected correctly. |
| F1-score | Harmonic mean of precision and recall. |
| Macro-F1 | Average F1-score across the four classes, giving each class equal weight. |
| Confusion Matrix | Shows correct and incorrect classifications for each class. |

Interpret metrics alongside the class distribution, since network intrusion datasets may be imbalanced.

After replacing the testing partition, rerun the project's evaluation script and refresh any stored report metrics, plots, or JSON artifacts consumed by the Reports page. Do not reuse the old full-testing-set metrics as if they were calculated on the new 90% partition.

## 6. Technology Stack

| Component | Technologies |
|---|---|
| Machine Learning | Python, Pandas, NumPy, Scikit-learn |
| Backend | FastAPI, Uvicorn |
| Frontend | React, JavaScript, Vite |
| Styling | CSS / Tailwind CSS |
| Dataset | UNSW-NB15 |
| Classification Model | Decision Tree Classifier |
| Deployment | GitHub Pages (frontend), Render (backend) |
| Version Control | Git, GitHub |

## 7. Getting Started

### 7.1 Clone the repository

```bash
git clone https://github.com/OptiSolvD/netSentinel-.git
cd netSentinel-
```

### 7.2 Create and activate a Python environment

```bash
python -m venv .venv
```

**Windows:**

```bash
.venv\Scripts\activate
```

**Linux / macOS:**

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

### 7.3 Configure the frontend API URL

Create `frontend/.env` and set the backend API base URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

For production, the frontend is configured to communicate with the deployed Render API. If deploying to another backend, set `VITE_API_BASE_URL` in the frontend build environment accordingly.

### 7.4 Start the backend

From the repository root:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The local backend is available at `http://localhost:8000`.

API documentation is available at `http://localhost:8000/docs`.

### 7.5 Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local frontend URL, usually `http://localhost:5173`.

## 8. API Endpoints

The FastAPI backend exposes API functionality under `/api/v1`. The main endpoint groups include:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Checks API health and model availability. |
| POST | `/api/v1/validate` | Validates uploaded CSV input. |
| POST | `/api/v1/predict` | Performs prediction on uploaded CSV traffic. |
| POST | `/api/v1/predict/single` | Predicts a single network-flow record. |
| POST | `/api/v1/predict/batch` | Predicts a batch of network-flow records. |
| POST | `/api/v1/explain` | Provides an explanation for a prediction. |
| GET | `/api/v1/training-context` | Returns training and dataset context. |
| GET | `/api/v1/model/metadata` | Returns model metadata. |
| GET | `/api/v1/model/tree-structure` | Returns the Decision Tree structure. |
| GET | `/api/v1/model/evaluation` | Returns model evaluation information. |
| GET | `/api/v1/model-evolution/comparison` | Returns model-evolution comparisons. |

For request and response details, see [`docs/api_contract.md`](docs/api_contract.md).

## 9. Running Backend Tests

From the repository root:

```bash
python -m pytest backend/tests/ -v
```

The backend test suite covers API behavior and prediction/input-validation functionality.

## 10. Deployment

NetSentinel uses separate services for the frontend and backend:

- **Frontend:** GitHub Pages.
- **Backend:** Render.
- **API communication:** The React frontend communicates with the FastAPI backend using `VITE_API_BASE_URL`.

The deployed backend API base URL is:

```text
https://netsentinel-api-zvqk.onrender.com/api/v1
```

## 11. Current Scope and Future Enhancements

### Current implementation

- Dataset-based network intrusion detection using uploaded CSV files.
- Four-class network traffic classification.
- CSV input validation and prediction.
- Evaluation when ground-truth labels are available.
- Prepared demonstration datasets for Normal, attack-only, and mixed traffic.
- Interactive Decision Tree visualization.
- Model evaluation/report information and model-evolution views.

### Future enhancements

- Live network packet capture and continuous monitoring.
- Integration with packet-analysis tools such as Wireshark and Suricata.
- Real-time intrusion alerts and notifications.
- Continuous traffic-analysis dashboards.

These are planned extensions and are not part of the currently implemented CSV-based workflow.

## 12. Dataset Reference

NetSentinel uses the UNSW-NB15 network intrusion detection benchmark dataset.

**Reference**

Moustafa, N. and Slay, J. (2015). *UNSW-NB15: A comprehensive data set for network intrusion detection systems.*

Official dataset information: [UNSW Canberra Cyber – UNSW-NB15 Dataset](https://research.unsw.edu.au/projects/unsw-nb15-dataset)

---

**NetSentinel – An ML-powered approach to network intrusion detection and traffic classification.**
