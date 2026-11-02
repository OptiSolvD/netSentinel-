#!/usr/bin/env python
# coding: utf-8

# # Imports 
# 

# In[3]:


import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

import seaborn as sns

# Display configuration
pd.set_option("display.max_columns", None)
pd.set_option("display.max_rows", 100)

sns.set_theme(style="whitegrid")


# ## Loading the filtered datasets

# In[4]:


train_df = pd.read_csv(
    "../../data/processed/selected_training.csv"
)

test_df = pd.read_csv(
    "../../data/processed/selected_testing.csv"
)

print("Training dataset shape:", train_df.shape)
print("Testing dataset shape:", test_df.shape)


# ## Dataset Overview
# 

# In[5]:


print("TRAINING DATASET")
print("=" * 50)

print("Rows:", train_df.shape[0])
print("Columns:", train_df.shape[1])

print("\nTESTING DATASET")
print("=" * 50)

print("Rows:", test_df.shape[0])
print("Columns:", test_df.shape[1])


# ## Inspecting columns and data types 

# In[ ]:


# compact summary of the entire dataframe 

print("\nDataset information:")
train_df.info()


# ## Missing value analysis

# In[11]:


missing_values = train_df.isnull().sum()

missing_summary = pd.DataFrame({
    "Missing_Count": missing_values,
    "Missing_Percentage": (
        missing_values / len(train_df)
    ) * 100
})

missing_summary = missing_summary.sort_values(
    by="Missing_Percentage",
    ascending=False
)

print(missing_summary)


# ## Duplicate testing 

# In[ ]:


print("Duplicate records in training:", train_df.duplicated().sum())
print("Duplicate records in testing:", test_df.duplicated().sum())


# ## Target distribution 

# In[14]:


print("Training category distribution:")

print(
    train_df["attack_cat"]
    .fillna("Normal")
    .value_counts()
)

print("\nTesting category distribution:")

print(
    test_df["attack_cat"]
    .fillna("Normal")
    .value_counts()
)


# ##  Numerical and categorical features

# In[15]:


target_columns = ["label", "attack_cat"]

X_analysis = train_df.drop(
    columns=target_columns
)

numeric_features = X_analysis.select_dtypes(
    include=["number"]
).columns.tolist()

categorical_features = X_analysis.select_dtypes(
    include=["object", "category", "bool"]
).columns.tolist()

print("Numerical features:")
print(numeric_features)

print("\nCategorical features:")
print(categorical_features)

print("\nNumber of numerical features:", len(numeric_features))
print("Number of categorical features:", len(categorical_features))


# ## Constant-value features

# In[18]:


constant_features = [
    column
    for column in X_analysis.columns
    if X_analysis[column].nunique(dropna=False) <= 1
]

print("Constant-value features:")
print(constant_features)

