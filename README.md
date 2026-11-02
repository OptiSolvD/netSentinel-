# NetSentinel

NetSentinel is an intrusion-detection project that combines machine learning
experimentation, a prediction API, a web interface, and deployment
configuration. The repository is structured below as a planned project layout.

## Project structure

| Directory | Responsibility |
|---|---|
| `docs/` | Project documentation, architecture, implementation plan, and screenshots |
| `data/raw/` | Original downloaded UNSW-NB15 files |
| `data/processed/` | Cleaned or transformed datasets that are saved for reuse |
| `data/samples/` | Small sample CSV files for application testing |
| `ml/notebooks/` | Exploratory analysis, model experiments, and visualizations |
| `ml/src/` | Reusable Python scripts for preprocessing, training, prediction, and evaluation |
| `ml/artifacts/` | Final trained model and preprocessing pipeline |
| `ml/results/` | Metrics, plots, and evaluation reports |
| `backend/` | FastAPI application and prediction services |
| `frontend/` | React user interface |
| `deployment/` | AWS EC2 setup and Nginx configuration |

## Optional components

This is the complete planned structure, not a requirement to implement every
file immediately. Authentication, database, and other optional modules may
remain unused if those features are not selected. Empty directories may be
populated, added incrementally, or omitted in later implementations.

## Data and model artifacts

Large original datasets and trained model artifacts should generally not be
committed to Git. Keep them in the locations above for local development or
store them in an external artifact repository. The repository should contain
the reproducible preprocessing, training, and download instructions instead.

### UNSW-NB15 dataset

1. Obtain UNSW-NB15 from its official source or another approved dataset host.
2. Follow the dataset provider's license and access requirements.
3. Place the original downloaded files in `data/raw/`.
4. Run the documented preprocessing workflow to create datasets in
   `data/processed/`.
5. Small, non-sensitive examples may be stored in `data/samples/` for API and
   UI testing.

### Trained model

1. Run the training pipeline in `ml/src/train.py`.
2. Save the final model and preprocessing pipeline in `ml/artifacts/`.
3. If Git-based distribution is unsuitable because files are large, publish
   the artifacts externally and record the download location and checksum.
4. Keep the exact training configuration, software versions, metrics, and
   evaluation report under `ml/results/`.