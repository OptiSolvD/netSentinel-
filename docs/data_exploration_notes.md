# NetSentinel Data Exploration Notes

> **Dataset Reference**: UNSW-NB15 Network Intrusion Dataset  
> **Source**: Cyber Range Lab of the Australian Centre for Cyber Security (ACCS)  
> **Scope**: Raw files, class frequencies, duplicate audit, and covariate shifts

---

## 1. Class Counts & Frequencies

### 1.1. Raw UNSW-NB15 Files
- `UNSW_NB15_training-set.csv`: 175,341 records, 45 columns
- `UNSW_NB15_testing-set.csv`: 82,332 records, 45 columns

### 1.2. Filtered 6-Class Taxonomy Counts

| Category | Raw Training Set | Training % | Raw Testing Set | Testing % |
| :--- | :--- | :--- | :--- | :--- |
| **Normal** | 56,000 | 45.31% | 37,000 | 62.14% |
| **Exploits** | 33,393 | 27.02% | 11,132 | 18.69% |
| **Fuzzers** | 18,184 | 14.71% | 6,062 | 10.18% |
| **DoS** | 12,264 | 9.92% | 4,089 | 6.87% |
| **Analysis** | 2,000 | 1.62% | 677 | 1.14% |
| **Backdoor** | 1,746 | 1.41% | 583 | 0.98% |
| **Total Filtered** | **123,587** | **100.0%** | **59,543** | **100.0%** |

---

## 2. Duplicate Flow Audit

Network flows were examined after excluding metadata columns (`id`, `label`, `attack_cat`):
- **Exact duplicate feature vectors**: 33,862 records (27.4% of training set).
- **Exact duplicate all-column rows** (features + label identical): 28,768 records.
- **Conflicting label rows** (identical features with differing labels): 5,094 records.
- **Clean retained training set**: 89,725 records (exported to `data/processed/clean_train.csv`).

---

## 3. Exploratory Diagnostic Plots

The clean pipeline generated the following diagnostic plots in `ml/results/plots/`:
1. `confusion_matrix.png`: 6x6 multiclass confusion matrix on the official held-out test set demonstrating high attack sensitivity (95.38% Attack Recall).
2. `feature_importance.png`: Top 20 features ranked by Gini importance from the Random Forest model. Top contributors include:
   - `sttl` (Source time-to-live)
   - `ct_state_ttl` (State-TTL correlation counter)
   - `sbytes_per_spkt` (Source payload density ratio)
   - `rate` and `log_rate` (Connection transmission rate)
   - `smean` (Mean size of packets transmitted by source)
   - `byte_ratio` (Outbound vs inbound payload balance)
3. `threshold_tuning_tradeoff.png`: False Alarm Rate vs Attack Recall curve across probability decision thresholds.
4. `id_leak_demonstration.png`: Scatter plot of sequential row ID vs category demonstrating how raw ID leaks scenario timing.
