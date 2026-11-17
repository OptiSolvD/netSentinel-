# Stage 3 model selection

Selected model: Original Random Forest

Validation macro-F1: 0.5177

Validation accuracy: 0.7981

Attack recall: 0.9523

Normal false-positive rate: 0.0810

Selection rule: Highest validation macro-F1 among candidates meeting the 10% normal-FPR operating target

Minority-class recalls: Analysis 0.1075, Backdoor 0.1461, DoS 0.1724.

The conservative tuned Random Forest threshold of 0.65 came from grouped out-of-fold fit predictions. It reached 9.01% normal FPR on validation but reduced macro-F1 to 0.4163. The official test set was not loaded or evaluated.
