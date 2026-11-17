# Final four-class evaluation

The frozen Decision Tree was retrained on 119,841 eligible training rows and evaluated once on 58,283 retained test rows.

Test accuracy: 0.7077; macro-F1: 0.5463; weighted-F1: 0.7280; attack recall: 0.5120; Normal false-positive rate: 0.0794.

Excluded test classes: Analysis, Backdoor (1,260 rows). Analysis and Backdoor were excluded from training, so this model cannot reliably identify them. Validation figures are the stored selection results (macro-F1 0.6985) and are not test-tuned.