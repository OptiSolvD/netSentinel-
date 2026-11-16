# NetSentinel Architectural Decisions Log (ADR)

> **Document Status**: Active  
> **Last Updated**: 2026-11-16

This document records the architectural and machine learning design decisions made during the development of NetSentinel v2.

---

## ADR-001: Strict Exclusion of `id` Column

- **Date**: 2026-11-16
- **Status**: Accepted & Enforced
- **Context**: The raw UNSW-NB15 files contain an `id` column. In v1, keeping `id` inside feature matrix $X$ resulted in the decision tree splitting on sequential row indices, causing catastrophic target leakage and artificial scores (>98%).
- **Decision**: Establish an immutable architectural invariant: `id` is an index, never a feature. It is filtered out immediately upon data ingestion in `ml/src/preprocess.py` and stripped in `ml/src/predict.py`.
- **Consequences**: Evaluation scores drop to genuine, honest numbers (CV Macro F1 ~0.494), but models now generalize cleanly to unseen network telemetry without memorizing sequence ordering.

---

## ADR-002: Deduplication of Feature Records in Training Data

- **Date**: 2026-11-16
- **Status**: Accepted
- **Context**: Audit revealed 33,862 duplicate feature rows (27.4% of filtered training set) and 5,094 conflicting label rows where identical telemetry signatures had contradictory labels (`Normal` vs `Exploits`).
- **Decision**: Drop duplicate feature rows from the training set, retaining unique first occurrences (reducing training set from 123,587 to 89,725 rows). Leave the official test set distribution untouched to evaluate against real testbed conditions.
- **Consequences**: Prevents data snooping across validation folds and eliminates gradient thrashing on contradictory labels.

---

## ADR-003: Selection of the 6-Class Taxonomy (Normal + 5 Attack Categories)

- **Date**: 2026-11-16
- **Status**: Accepted
- **Chosen Classes**:
  1. `Normal`: Baseline benign network traffic.
  2. `Exploits`: Buffer overflows, privilege escalation, and application exploits.
  3. `Fuzzers`: Automated test inputs and boundary violations designed to induce crashes.
  4. `DoS`: Denial of Service flood traffic saturating service queues.
  5. `Analysis`: Port scans, vulnerability probing, and web reconnaissance.
  6. `Backdoor`: Stealthy persistent remote access beacons and command-and-control channels.
- **Excluded Categories**: `Generic` (synthetic payload patterns with high artifact bias), `Reconnaissance` (largely redundant with Analysis), `Shellcode` (subsumed by Exploits), `Worms` (statistically negligible: 44 test instances).
- **Reason for Choice**:
  - **Operational Actionability**: Security Operations Centers (SOC) take distinctly different incident response actions for each of these 5 attack categories (e.g. rate-limiting DoS, patching/isolating for Exploits/Backdoors, updating firewall rules for Analysis/Fuzzers).
  - **Statistical Viability**: Retains sufficient sample volume across categories while providing a realistic test of both high-volume attacks and low-frequency stealth attacks.

---

## ADR-004: Chronological Block-Grouped Cross-Validation

- **Date**: 2026-11-16
- **Status**: Accepted
- **Context**: Network traffic occurs in bursts and temporal sessions. Standard stratified random K-Fold mixes packets from the same session between train and validation folds, causing inter-session data snooping.
- **Decision**: Partition training data into 10 chronological row-block groups and use 5-fold `GroupKFold`.
- **Consequences**: Prevents cross-session leakage and yields honest out-of-fold generalization metrics.

---

## ADR-005: Dual Model Inference (Random Forest + Decision Tree)

- **Date**: 2026-11-16
- **Status**: Accepted
- **Decision**: Package both the primary production model (`RandomForestClassifier` with ratios) and an interpretable secondary model (`DecisionTreeClassifier`) into `model.joblib`. Return both predictions and calculate real-time agreement rate on every inference request.
- **Consequences**: Enables the frontend to highlight disagreement rows for analyst triage and provides instant rule-based explainability via the Decision Tree's path.

---

## ADR-006: Real Pipeline Stepper Telemetry (No Fake Animations)

- **Date**: 2026-11-16
- **Status**: Accepted
- **Decision**: The backend `POST /api/v1/predict` endpoint returns a structured `pipeline_stages` array containing real performance numbers:
  1. `file_received`: File name, row count, column count.
  2. `validation`: Exact lists of missing, extra, and ignored columns.
  3. `preprocessing`: Number of filled missing values, unseen categories handled, and input-to-feature count.
  4. `prediction`: Model name, version, inference milliseconds, and rows per second.
  5. `results`: Total rows, attack count, normal count, low-confidence count, agreement rate.
- **Consequences**: The frontend stepper is completely backed by verifiable server-side execution metrics.
