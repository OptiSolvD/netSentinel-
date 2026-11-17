# netSentinel four-class metric audit

## Scope and data availability

This audit used only stored confusion matrices, CSV results, JSON metadata, and the saved improved pipeline. No model was retrained and the official test CSV was not rerun. Both validation confusion matrices have class order `Normal, Exploits, Fuzzers, DoS`, total 23,969 rows, and identical row supports: Normal 11,200; Exploits 6,679; Fuzzers 3,637; DoS 2,453. Therefore they use the same validation partition and class ordering.

## Definitions checked

- Conventional normal false-alarm rate = Normal samples predicted as any attack / all actual Normal samples = `CM[Normal, Exploits/Fuzzers/DoS].sum() / CM[Normal, :].sum()`.
- This equals `1 - Normal recall`.
- Binary attack detection recall = all correctly classified attack samples / all actual attack samples, pooling Exploits, Fuzzers, and DoS.
- Mean attack-class recall is a different statistic: the unweighted mean of the three attack recalls.

## Confirmed reporting problems

The original final-evaluation notebook calculated `cm[1:, 0].sum() / cm[1:, :].sum()`. That is the fraction of attack rows incorrectly predicted as Normal (an attack false-negative rate), not the conventional normal false-alarm rate. The stored official-test value 0.0794 is therefore mislabeled. The stored Normal recall is 0.7647, so the correct conventional normal false-alarm rate is `1 - 0.7647 = 0.2353`.

The improvement notebook used the same wrong denominator. Its stored Random Forest value 0.0071 is not a normal false-alarm rate. From its stored validation confusion matrix, the correct value is 0.1583, which again equals `1 - Normal recall` (Normal recall 0.8417).

The original validation Decision Tree value 0.0860 is consistent with the conventional definition and equals `1 - 0.9140`; it was not affected in the historical comparison file.

The historical `attack_recall` field is also mislabeled in the older comparison outputs: it is the mean of the three attack-class recalls, not pooled binary attack recall. Correct pooled values are in `corrected_metric_comparison.csv`.

## Corrected validation comparison

The original Decision Tree has macro-F1 0.6985, accuracy 0.7951, conventional normal false-alarm rate 0.0860, binary attack recall 0.6907, DoS recall 0.3783, and Fuzzers recall 0.6640.

The improved Random Forest has macro-F1 0.7249, accuracy 0.7749, conventional normal false-alarm rate 0.1583, binary attack recall 0.7163, DoS recall 0.8304, and Fuzzers recall 0.8859. Its macro-F1 and minority recalls improve, but its conventional normal false-alarm rate is worse than the Decision Tree and exceeds the 10% preference.

Accuracy decreases because the Random Forest trades more Normal and Exploits errors for substantially better DoS and Fuzzers detection. This is a genuine operating-point trade-off, not evidence of a bug.

## Improved Random Forest validity

A provenance inconsistency is also present: the saved `best_improved_model.joblib` contains 100 trees, while the current improvement notebook source shows `n_estimators=10` after the CPU-budget reduction, and the comparison CSV omits this parameter. The saved model itself is inspectable and its exact estimator has 100 trees; the notebook should be corrected in a future reproducibility pass (outside this audit).

The saved pipeline is a train-only preprocessing pipeline: median imputation for numeric columns and most-frequent imputation plus `OneHotEncoder(handle_unknown='ignore')` for categorical columns. The estimator is `RandomForestClassifier(n_estimators=100, max_depth=25, min_samples_leaf=3, class_weight='balanced_subsample', random_state=42, n_jobs=2)`. The experiment reused the existing fit/validation split and did not read the official test data. No leakage was found in the inspected workflow.

## Recommendation and submission status

Using the corrected conventional false-alarm definition, retain the original Decision Tree as the safer submission recommendation because it stays below the 10% false-alarm preference and has higher accuracy. Consider the improved Random Forest only if the project explicitly prioritizes DoS/Fuzzers recall over false alarms. The four-class project is ready for submission only if the reports are updated to use the corrected labels and clearly state that Analysis and Backdoor are outside the model scope. The historical files were preserved; corrections are limited to this audit folder.
