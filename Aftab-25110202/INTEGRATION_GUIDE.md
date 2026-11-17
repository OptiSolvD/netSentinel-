# netSentinel ML integration guide

## Model input and output

The saved four-class pipeline is [`experiments/four_class/models/final_four_class_model.joblib`](experiments/four_class/models/final_four_class_model.joblib). It expects one row with these 42 named predictors, in any DataFrame column order:

`dur`, `proto`, `service`, `state`, `spkts`, `dpkts`, `sbytes`, `dbytes`, `rate`, `sttl`, `dttl`, `sload`, `dload`, `sloss`, `dloss`, `sinpkt`, `dinpkt`, `sjit`, `djit`, `swin`, `stcpb`, `dtcpb`, `dwin`, `tcprtt`, `synack`, `ackdat`, `smean`, `dmean`, `trans_depth`, `response_body_len`, `ct_srv_src`, `ct_state_ttl`, `ct_dst_ltm`, `ct_src_dport_ltm`, `ct_dst_sport_ltm`, `ct_dst_src_ltm`, `is_ftp_login`, `ct_ftp_cmd`, `ct_flw_http_mthd`, `ct_src_ltm`, `ct_srv_dst`, `is_sm_ips_ports`.

Do not send `id`, `label`, or `attack_cat` as predictors. The saved pipeline imputes numeric fields and imputes/one-hot encodes categorical fields (`proto`, `service`, `state`); it ignores previously unseen category values. It returns one of `Normal`, `Exploits`, `Fuzzers`, or `DoS`. Analysis and Backdoor were excluded from training, so the model cannot reliably identify them.

The pipeline was smoke-checked with a synthetic one-row DataFrame containing all 42 columns and categorical string values. It returned `Normal`, which is among its four saved classes. No official test records were used for this check.

## Metric definitions for the website

For a multiclass confusion matrix whose rows are actual labels and columns are predicted labels:

- **Accuracy:** correct predictions divided by all evaluated rows.
- **Precision for class C:** true positives for C divided by all predictions of C.
- **Recall for class C:** true positives for C divided by all actual C rows.
- **F1 for class C:** harmonic mean of that class's precision and recall.
- **Macro-F1:** arithmetic mean of per-class F1, giving each class equal weight.
- **Weighted-F1:** per-class F1 averaged by each class's support (number of actual rows).
- **Normal false-alarm rate (FAR):** actual Normal rows predicted as any attack divided by all actual Normal rows. For this four-class task, `FAR = (CM[Normal, Exploits] + CM[Normal, Fuzzers] + CM[Normal, DoS]) / sum(CM[Normal, :]) = 1 - Normal recall`.
- **Pooled binary attack detection recall:** among actual attack rows (Exploits, Fuzzers, DoS), the fraction predicted as any attack class: `sum(CM[attack rows, attack columns]) / sum(CM[attack rows, all columns])`. Misclassifying one attack type as another still counts as attack detected.
- **Mean attack-class recall:** arithmetic mean of Exploits recall, Fuzzers recall, and DoS recall. This is not pooled binary attack detection recall.
- **Attack-to-Normal miss rate:** actual attack rows predicted Normal divided by all actual attack rows. This is also not the Normal FAR.

Use the same class order (`Normal`, `Exploits`, `Fuzzers`, `DoS`) and denominators when displaying values. Avoid the ambiguous label “FPR” unless its positive/negative class and denominator are stated; use “Normal false-alarm rate” for the definition above.

## Authoritative corrected values and source files

The historical audit CSV contains a `binary_attack_recall` value calculated from only the diagonal of the attack submatrix. That is exact attack-type recall pooled over attacks, not binary attack detection recall. Its `stored_attack_recall` fields in the corrected comparison are also historical mean-per-class values. Do not display either field as pooled binary attack recall. The values below were recalculated from the saved confusion matrices using the definitions above. The official test confusion matrix is read from a saved artifact; the test set was not rerun.

| Model / partition | Accuracy | Macro-F1 | Weighted-F1 | Normal FAR | Pooled attack recall | Normal recall | Exploits recall | Fuzzers recall | DoS recall |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Original Decision Tree, validation | 0.7951 | 0.6985 | 0.7916 | 0.0860 | 0.9261 | 0.9140 | 0.8200 | 0.6640 | 0.3783 |
| Improved Random Forest, validation | 0.7749 | 0.7249 | 0.7890 | 0.1583 | 0.9929 | 0.8417 | 0.5821 | 0.8859 | 0.8304 |
| Original Decision Tree, official test (historical evaluation) | 0.7077 | 0.5463 | 0.7280 | 0.2353 | 0.9206 | 0.7647 | 0.8217 | 0.4474 | 0.2671 |

Authoritative source artifacts:

- Validation confusion matrices: [`experiments/four_class/results/model_comparison.csv`](experiments/four_class/results/model_comparison.csv) and [`experiments/four_class/improvement/results/improvement_comparison.csv`). The validation values above are recomputed from these stored matrices.
- Detailed corrected comparison (including per-class precision/recall/F1): [`experiments/four_class/audit/corrected_metric_comparison.csv`](experiments/four_class/audit/corrected_metric_comparison.csv). Its `conventional_normal_false_alarm_rate` and per-class fields are useful; its `binary_attack_recall` field is not pooled binary recall and must not be used for that website measure.
- Official test confusion matrix: [`experiments/four_class/results/final_test_confusion_matrix.csv`](experiments/four_class/results/final_test_confusion_matrix.csv).
- Official test classification report: [`experiments/four_class/results/final_test_classification_report.csv`](experiments/four_class/results/final_test_classification_report.csv).
- Historical test summary and metrics JSON: [`experiments/four_class/results/final_evaluation_summary.md`](experiments/four_class/results/final_evaluation_summary.md) and [`experiments/four_class/results/final_test_metrics.json`](experiments/four_class/results/final_test_metrics.json). Their saved `normal_false_positive_rate: 0.0794` is mislabeled due to the wrong denominator. The corrected FAR is 0.2353 from `1 - Normal recall`. The JSON's `attack_recall: 0.5120` is mean attack-class recall, not pooled binary recall.
- Metric definitions and audit findings: [`experiments/four_class/audit/metric_audit.md`](experiments/four_class/audit/metric_audit.md). Treat its definitions as guidance, while observing the specific CSV-column caveat above.

## Integration display guidance

Show validation results separately from official test results. The original Decision Tree met the 10% FAR preference on validation, but its corrected official test FAR is 23.53%. The improved Random Forest has stronger validation Fuzzers and DoS recall, but validation FAR is 15.83%, above that preference. Do not use the official test numbers to select the website's model. Clearly label the four-class scope and explain that Analysis and Backdoor are unsupported classes.
