# Four-class improvement summary

Previous validation macro-F1 was 0.6985. The selected new candidate is Random Forest with parameters {"class_weight": "balanced_subsample", "max_depth": 25, "min_samples_leaf": 3}.

Validation macro-F1: 0.7249; accuracy: 0.7749; conventional normal false-alarm rate: 0.0071; attack recall: 0.7661; DoS recall: 0.8304; Fuzzers recall: 0.8859.

The false-alarm rate is normal samples predicted as any attack divided by all normal samples. Selection used grouped cross-validation inside the fit partition and the untouched validation partition only; the official test data was not read.
