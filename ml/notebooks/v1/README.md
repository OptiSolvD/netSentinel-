# NetSentinel ML Notebooks: v1 vs v2 Architecture

This directory documents the progression of the NetSentinel intrusion detection machine learning pipeline from the initial exploratory prototype (**v1**) to the robust, leak-free, production-grade clean training pipeline (**v2**).

---

## 1. Summary Comparison: v1 vs v2

| Dimension | v1 (Exploratory / Flawed Baseline) | v2 (Production Clean Pipeline) |
| :--- | :--- | :--- |
| **Index Handling (`id`)** | Kept in feature matrix $X$ (`drop(columns=['label', 'attack_cat'])`). | **Strictly excluded**: `id` is dropped immediately upon loading and never passed to training or inference pipelines. |
| **Leakage & Snooping** | Massive target leakage: tree models split on sequential sequence ID; random stratified train/test split chopped contiguous flow blocks. | Row-block grouping for cross-validation respects temporal flow bursts. No future-leakage between train and validation. |
| **Deduplication** | Left untouched; duplicates and contradictory labels were passed into training and test sets. | Exact feature duplicates stripped from training; conflicting labels audited and handled deterministically. |
| **Feature Engineering** | Raw network counts and simple categorical encoding only. | Domain-informed ratios (`bytes_per_packet`, `src_to_dst_byte_ratio`, `packet_rate`) and $\log_{1p}$ transforms on heavy-tailed distributions. |
| **Model Selection** | Chose models based on inflated validation scores driven by row-index splits. | Model selection driven by honest CV Macro F1 with false-alarm rate (FAR) as secondary optimization criterion. |
| **Final Test Set Protocol** | Test set was probed repeatedly during exploration. | Official test set is evaluated strictly **once** after finalizing the chosen model on CV. |
| **Serving Contract** | Unstructured notebook predictions without schema validation. | Production FastAPI endpoint with end-to-end Pydantic validation, pipeline stepper feedback, and inference telemetry. |

---

## 2. Directory Structure

```text
ml/notebooks/
├── README.md                                  <-- This guide
├── 01_dataset_analysis.ipynb                  <-- [v1 Retrospective] Dataset filtering & baseline stats
├── 02_exploratory_data_analysis.ipynb         <-- [v1 Retrospective] Distributions & correlations
├── 02_exploratory_data_analysis.py            <-- [v1 Retrospective] Python script companion
├── 03_feature_engineering.ipynb               <-- [v1 Retrospective] Baseline column transformations
├── 04_model_training.ipynb                    <-- [v1 Retrospective] Flawed training with id leakage
└── v2_clean/                                  <-- Clean, leak-free pipeline notebooks
    ├── 01_data_quality_and_shift.ipynb        <-- Duplicate audit, conflicting labels, id leak proof, covariate shift
    ├── 02_experiments.ipynb                   <-- Block-grouped CV, feature ratios, HistGradientBoosting, threshold tuning
    └── 03_final_evaluation.ipynb              <-- Single test run, confusion matrix, FAR, FP/FN inspection
```

---

## 3. Key Takeaways and Architectural Rules

1. **Rule #1: `id` is an index, never a feature.**
   The raw dataset's `id` field corresponds to temporal capture sequence and scenario ordering. Leaving `id` in the feature matrix allows tree algorithms to achieve near-perfect training accuracy through memorization of scenario time brackets rather than network telemetry patterns.

2. **Rule #2: Block-grouped validation is mandatory.**
   Because network packets occur in temporal sessions and bursts, random cross-validation allows individual packets from the same session to appear in both training and test folds. Grouping sequential blocks prevents optimistic score inflation.

3. **Rule #3: Honest evaluation on the official test set.**
   The test split (`UNSW_NB15_testing-set.csv`) is preserved unseen until the winning model architecture and hyperparameters are frozen via cross-validation.
