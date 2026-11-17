# ML experiment history

This is a record of the saved experiments, not a new evaluation. Unless a row says *official test*, figures below are from validation. The original six-class task and later four-class task have different targets and populations; their macro-F1 values must not be treated as a head-to-head score comparison.

## Six-class benchmark

The first benchmark retained Normal, Analysis, Backdoor, DoS, Exploits, and Fuzzers from UNSW-NB15. Generic, Reconnaissance, Shellcode, and Worms were outside this benchmark. The [preprocessing notebook](notebooks/01_preprocessing.ipynb) and [data-quality report](results/data_quality_report.json) record 123,587 filtered training rows, a grouped fit/validation split (98,869/24,718), and 42 predictors. The official test data remained separate.

The [baseline notebook](notebooks/02_model_training.ipynb) and [baseline comparison](results/model_comparison.csv) report:

| Six-class validation model | Macro-F1 | Accuracy | Reason not selected as final six-class model |
|---|---:|---:|---|
| Dummy, most frequent | 0.1039 | 0.4531 | Sanity baseline; no minority-class detection. |
| Decision Tree | 0.5183 | 0.7675 | Reasonable macro-F1, but lower accuracy and higher normal false alarms than the selected forest. |
| Random Forest | 0.5193 | 0.7986 | Strong baseline; a later Stage 3 reassessment selected the original forest. |
| Extra Trees | 0.4995 | 0.7908 | Lower macro-F1 than the forest. |
| HistGradientBoosting | 0.5102 | 0.7994 | Similar accuracy, weaker DoS recall (0.0664). |

The [Stage 2 notebook](notebooks/03_additional_models_tuning.ipynb), [comparison](results/stage2_model_comparison.csv), and [tuning log](results/stage2_tuning_log.csv) add Logistic Regression (0.4260 macro-F1; balanced 0.4628), Bagging Tree (0.5202), AdaBoost (0.4128), and XGBoost (0.5066). Targeted tuned results include Random Forest (0.5292), Decision Tree (0.5183), and HistGradientBoosting (0.5061). These higher-recall weighted/tuned configurations often raised normal false alarms: the tuned forest reached 0.1700 and tuned boosting 0.1847. Bagging was competitive but did not improve the final operating trade-off. Logistic Regression and AdaBoost had lower macro-F1; XGBoost did not improve on the leading forests.

The [Stage 3 error analysis](notebooks/04_error_analysis_final_selection.ipynb), [finalist comparison](results/stage3_finalist_comparison.csv), and [selection report](results/stage3_model_selection_report.md) reassessed the original Random Forest at validation macro-F1 0.5177, accuracy 0.7981, and normal false-alarm rate 0.0810. It was chosen as the six-class candidate under a 10% validation normal false-alarm preference. Analysis, Backdoor, and DoS recall remained low (0.1075, 0.1461, 0.1724). A conservative threshold derived from grouped out-of-fold predictions lowered the tuned forest's false-alarm rate to 0.0901 but macro-F1 fell to 0.4163. These records do not constitute an official six-class test evaluation.

## Four-class investigation and selection

Because Analysis and Backdoor had particularly weak recall, a separate experiment studied Normal, Exploits, Fuzzers, and DoS. Removing two classes changes the question: this model cannot identify Analysis or Backdoor. The [four-class notebook](experiments/four_class/01_four_class_experiment.ipynb) reused the saved split indices after filtering, yielding 95,872 fit and 23,969 validation rows. Its [comparison CSV](experiments/four_class/results/model_comparison.csv) reports these validation results:

| Four-class model | Macro-F1 | Accuracy | Conventional normal false-alarm rate | Selection issue |
|---|---:|---:|---:|---|
| Decision Tree baseline | 0.6985 | 0.7951 | 0.0860 | Selected under the 10% preference. |
| Random Forest baseline | 0.6925 | 0.8233 | 0.0801 | Higher accuracy, but DoS recall only 0.1761. |
| HistGradientBoosting baseline | 0.6868 | 0.8243 | 0.0776 | DoS recall only 0.1521. |
| XGBoost baseline | 0.6491 | 0.8191 | 0.0862 | DoS recall only 0.0542. |
| Decision Tree tuned | 0.7157 | 0.7644 | 0.1644 | Better DoS recall, above the false-alarm preference. |
| Random Forest tuned | 0.7266 | 0.7767 | 0.1562 | Highest macro-F1 here, above the false-alarm preference. |

The baseline Decision Tree was frozen for [final evaluation](experiments/four_class/02_final_evaluation.ipynb), retrained on all 119,841 eligible training rows, and evaluated on 58,283 four-class official test rows. **Official test:** macro-F1 0.5463, accuracy 0.7077, and corrected conventional normal false-alarm rate 0.2353. This test result was not used to select or tune the subsequent candidates. See [final metrics](experiments/four_class/results/final_test_metrics.json), [confusion matrix](experiments/four_class/results/final_test_confusion_matrix.csv), and the [metric audit](experiments/four_class/audit/metric_audit.md).

The later [improvement notebook](experiments/four_class/improvement/01_model_improvement.ipynb) explored regularization and class weighting using fit-only grouped cross-validation. Its [CV results](experiments/four_class/improvement/results/cross_validation_results.csv) and [validation results](experiments/four_class/improvement/results/improvement_comparison.csv) record a balanced Decision Tree at macro-F1 0.7134 and a balanced Random Forest at 0.7249. Both improve DoS/Fuzzers recall, but the [corrected comparison](experiments/four_class/audit/corrected_metric_comparison.csv) gives conventional normal false-alarm rates of 0.1681 for the improved tree (1 minus recorded Normal recall 0.8319) and 0.1583 for the improved forest. Thus neither meets the 10% preference. The improvement notebook's stored false-alarm column used an incorrect denominator. The improved forest was not evaluated on the official test set.

## Selection and reporting caveats

Macro-F1 gives each class equal weight, while accuracy can hide poor minority recall. The chosen four-class Decision Tree met the predeclared normal false-alarm preference on validation; the improved forest offers a different trade-off, with stronger DoS/Fuzzers recall and more normal alerts. The [audit](experiments/four_class/audit/metric_audit.md) supplies the false-alarm definition. Its *numeric* `binary_attack_recall` column has a separate error: it uses the trace of the attack submatrix (correct attack subtype) instead of its entire sum (any predicted attack). Recomputed pooled binary recall is 0.9261 for the original Decision Tree and 0.9929 for the improved forest on validation. The improvement CSV's `attack_recall` is instead mean attack-class recall. Historical files are preserved. The improved forest notebook's current tree-count setting also disagrees with its saved model (10 versus 100); see the audit before claiming exact rerun reproducibility.
