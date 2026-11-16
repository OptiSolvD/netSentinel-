# Four-class UNSW-NB15 experiment

This folder contains an independent experiment using four attack categories from the existing processed UNSW-NB15 training data:

- Normal
- Exploits
- Fuzzers
- DoS

Analysis and Backdoor are excluded for this experiment only. The saved fit and validation row indices are reused after filtering to these four classes. The official test file is not used here. The model inputs exclude `id`, `label`, and `attack_cat`.
