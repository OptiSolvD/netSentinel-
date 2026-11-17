# NetSentinel – Multi-Class Network Intrusion Detection System

NetSentinel is a machine-learning-based Network Intrusion Detection System (NIDS) developed using the UNSW-NB15 benchmark dataset. It analyzes network flow records, identifies potentially malicious activity, and classifies traffic into four categories: **Normal, Exploits, Fuzzers, and DoS**.

The project combines a machine learning pipeline, a FastAPI inference backend, and an interactive React dashboard to make network traffic analysis and model evaluation accessible through a web application.

## Live Application

- **Frontend:** [NetSentinel Web Application](YOUR_NETLIFY_URL)
- **Backend API:** https://netsentinel-api-zvqk.onrender.com
- **API Documentation:** https://netsentinel-api-zvqk.onrender.com/docs

## 1. Project Features

### 1.1 Overview
Provides an overview of NetSentinel, its intrusion detection capabilities, supported attack categories, and model information.

### 1.2 How It Works
Explains the workflow of the intrusion detection system, from supplying network flow data to preprocessing, model inference, and displaying classification results.

### 1.3 Test & Evaluate
Allows users to upload CSV datasets and analyze network traffic using the trained classification model.

Features include:
- CSV upload and input validation.
- Prediction of network flows into four supported classes.
- Prediction confidence and classification summaries.
- Evaluation metrics when ground-truth labels are available.
- Built-in sample datasets for quick demonstrations.

### 1.4 Live Traffic
The dashboard includes a Live Traffic section representing the planned real-time monitoring functionality. Direct network packet capture and continuous live traffic analysis are not currently implemented.

### 1.5 Reports
Provides access to the analysis results and reporting information available in the application.

### 1.6 Model Evolution
Presents information about the model development process and performance comparisons, helping users understand the changes made during experimentation.

### 1.7 Decision Tree Visualization
Provides an interactive, level-wise visualization of the trained Decision Tree.

The tree is displayed progressively rather than rendering every node simultaneously:

- **Level 0 – Root:** Displays the initial splitting condition.
- **Level 1:** Displays the immediate child nodes of the root.
- **Level 2:** Displays the next level of splits and leaf nodes.
- **Further levels:** Allow users to explore deeper branches of the tree.

Each node provides information such as:
- Splitting feature and threshold.
- Number of training samples.
- Gini impurity.
- Predicted class for leaf nodes.

Users can expand and collapse branches to explore the model's decision-making structure.

## 2. Supported Classification Categories

The current model supports four classes:

| Class | Description |
|---|---|
| Normal | Legitimate network traffic |
| Exploits | Traffic associated with exploitation attempts |
| Fuzzers | Traffic generated through fuzzing techniques |
| DoS | Denial-of-Service traffic |

The model uses **42 network traffic features** for classification. Identifier and target columns are excluded from model inputs.

## 3. Repository Structure

```text
netsentinel/
├── .pytest_cache/
├── .venv/
├── backend/
│   ├── app/
│   ├── tests/
│   └── requirements.txt
├── data/
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
├── README.md
└── UNSW_NB15_testing_4class.csv
```

### Directory Description

- **backend/** – FastAPI application, prediction endpoints, inference logic, and backend tests.
- **data/** – Dataset-related files, including raw, processed, and sample data.
- **docs/** – Project documentation, API contracts, and development notes.
- **frontend/** – React application, dashboard components, and public assets.
- **ml/** – Machine learning preprocessing, training, evaluation, prediction code, and model artifacts.
- **UNSW_NB15_testing_4class.csv** – Filtered official testing dataset containing only the four classes supported by NetSentinel.

## 4. Technology Stack

| Component | Technologies |
|---|---|
| Machine Learning | Python, Pandas, NumPy, Scikit-learn |
| Backend | FastAPI, Uvicorn |
| Frontend | React, JavaScript, Vite |
| Styling | CSS / Tailwind CSS |
| Dataset | UNSW-NB15 |
| Classification Model | Decision Tree Classifier |
| Deployment | Render, Netlify |
| Version Control | Git, GitHub |

## 5. Getting Started

### 5.1 Clone the Repository

```bash
git clone https://github.com/OptiSolvD/netSentinel-.git
cd netSentinel-
```

### 5.2 Create a Python Environment

```bash
python -m venv .venv
```

Activate the environment.

**Windows:**

```bash
.venv\Scripts\activate
```

**Linux / macOS:**

```bash
source .venv/bin/activate
```

Install the backend dependencies:

```bash
pip install -r backend/requirements.txt
```

### 5.3 Configure Environment Variables

Use `.env.example` as a reference for the required configuration.

Create `frontend/.env` and configure the backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

The GitHub Pages production build defaults to the deployed Render API URL. Set
`VITE_API_BASE_URL` in the build environment to override it when deploying elsewhere.

### 5.4 Start the Backend

From the repository root:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at:

```text
http://localhost:8000
```

Interactive API documentation:

```text
http://localhost:8000/docs
```

### 5.5 Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at the local URL printed by Vite, usually:

```text
http://localhost:5173
```

## 6. How to Test NetSentinel

NetSentinel currently performs **dataset-based network intrusion detection**. Users can upload previously collected network flow records in CSV format and analyze them using the trained model.

### 6.1 Use the Provided Four-Class Testing Dataset

The repository includes:

`UNSW_NB15_testing_4class.csv`

This dataset is derived from the original UNSW-NB15 official testing dataset by retaining only the four classes supported by the model:

- Normal
- Exploits
- Fuzzers
- DoS

The dataset contains **58,283 records**.

| Class | Number of records |
|---|---:|
| Normal | 37,000 |
| Exploits | 11,132 |
| Fuzzers | 6,062 |
| DoS | 4,089 |
| **Total** | **58,283** |

The original feature values are preserved. The dataset retains the 42 model input features along with the `attack_cat` and `label` ground-truth columns. The `id` column is excluded.

**Testing procedure:**

1. Clone or download the NetSentinel repository.
2. Locate `UNSW_NB15_testing_4class.csv` in the repository root.
3. Open the deployed NetSentinel website.
4. Navigate to the **Test & Evaluate** page.
5. Click **Choose file**.
6. Select `UNSW_NB15_testing_4class.csv`.
7. Submit the dataset for analysis.
8. Wait for the backend to complete prediction.
9. Examine the classification results and evaluation metrics.

### 6.2 Use Built-in Sample Datasets

The Test & Evaluate page also provides sample datasets for quick demonstrations:

| Sample | Purpose |
|---|---|
| 500-flow sample | Demonstrates the prediction workflow using a smaller dataset |
| Attack sample | Tests classification of attack traffic |
| Normal sample | Tests classification of legitimate traffic |
| Edge cases | Tests unusual input scenarios |

### 6.3 Upload Your Own Dataset

Users can upload their own CSV files containing the 42 required model input features.

For evaluation, the CSV should also contain the ground-truth `attack_cat` column.

**Input requirements:**

- All 42 expected model features must be present.
- `id` must not be passed as a model input.
- `attack_cat` and `label` are ground-truth information, not prediction features.
- For labelled evaluation, include only the four supported categories.
- Missing or incompatible features may result in validation errors.

### 6.4 Understanding Evaluation Metrics

When ground-truth labels are available, NetSentinel compares the actual classes against the model's predictions.

| Metric | Description |
|---|---|
| Accuracy | Percentage of correctly classified records |
| Precision | Proportion of correct predictions for a class |
| Recall | Proportion of actual records correctly detected |
| F1-score | Harmonic mean of precision and recall |
| Macro-F1 | Average F1-score across all four classes, giving each class equal importance |
| Confusion Matrix | Displays correct and incorrect classifications for each class |

Evaluation results should be interpreted alongside the class distribution, particularly because network intrusion datasets can be imbalanced.

## 7. Machine Learning Pipeline

The machine learning pipeline handles the preparation, training, evaluation, and prediction stages.

The main stages include:

1. **Data preprocessing:** Cleans and prepares the network traffic data.
2. **Feature preparation:** Selects the 42 required input features and excludes identifiers and target columns.
3. **Model training:** Trains classification models using the prepared training data.
4. **Model evaluation:** Evaluates the selected model using held-out data.
5. **Inference:** Uses the saved model artifact to classify uploaded network flow records.

The official testing data is kept separate from model training and tuning to provide an independent evaluation.

## 8. API Endpoints

The FastAPI backend exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Checks API health and model availability |
| POST | `/api/v1/validate` | Validates uploaded CSV features |
| POST | `/api/v1/predict` | Performs dataset-based traffic classification |
| POST | `/api/v1/explain` | Provides an explanation for an individual prediction |
| GET | `/api/v1/training-context` | Returns training and dataset context |
| GET | `/api/v1/model/metadata` | Returns model metadata |
| GET | `/api/v1/model/tree-structure` | Returns Decision Tree structure |
| GET | `/api/v1/model/evaluation` | Returns model evaluation information |
| GET | `/api/v1/model-evolution/comparison` | Returns model evolution comparisons |

For complete request and response specifications, refer to [`docs/api_contract.md`](docs/api_contract.md).

## 9. Running Backend Tests

Run the backend test suite from the repository root:

```bash
python -m pytest backend/tests/ -v
```

The tests cover API behavior, input validation, missing features, identifier exclusion, and prediction-related functionality.

## 10. Deployment

NetSentinel uses separate deployment services for its frontend and backend.

- **Frontend:** Netlify.
- **Backend:** Render.
- **API communication:** The React frontend communicates with the deployed FastAPI backend through `VITE_API_BASE_URL`.

For local development, configure the API URL to point to the local backend. For production, configure it to point to the deployed Render API.

## 11. Current Scope and Future Enhancements

### Current Implementation

- Dataset-based network intrusion detection.
- Four-class network traffic classification.
- CSV upload and prediction.
- Evaluation using ground-truth labels.
- Interactive Decision Tree visualization.
- Model performance and evolution information.

### Future Enhancements

- Live network traffic capture and continuous monitoring.
- Integration with packet analysis tools such as Wireshark and Suricata.
- Real-time intrusion alerts and notifications.
- Continuous network traffic analysis and monitoring dashboards.

These enhancements are planned extensions and are not part of the current implemented functionality.

## 12. Dataset Reference

NetSentinel uses the UNSW-NB15 network intrusion detection benchmark dataset.

**Reference:**

Moustafa, N. and Slay, J. (2015). UNSW-NB15: A comprehensive data set for network intrusion detection systems.

Official dataset information: [UNSW Canberra Cyber – UNSW-NB15 Dataset](https://research.unsw.edu.au/projects/unsw-nb15-dataset)

---

**NetSentinel – An ML-powered approach to network intrusion detection and traffic classification.**