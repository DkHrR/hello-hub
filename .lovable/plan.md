
# Plan: Dataset-Driven Diagnostic Engine

## Overview
Transform the current hardcoded diagnostic system into a data-driven one. The uploaded ETDD-70 dataset (35 dyslexic + 35 non-dyslexic students) will be processed, stored as structured reference profiles, and used to calibrate the diagnostic thresholds and scoring -- making dyslexia detection more accurate. The architecture will also support future ADHD and dysgraphia datasets.

## Current State
- Diagnostic thresholds (fixation duration, regression rate, chaos index, etc.) are **hardcoded** in `etdd70Engine.ts` and `useDyslexiaClassifier.ts`
- The chunked upload system stores raw files but does **nothing** with them after upload
- No mechanism exists to extract features from dataset files and use them as reference data

## What We Will Build

### 1. Dataset Reference Profiles Table
A new database table `dataset_reference_profiles` to store processed feature data extracted from the uploaded dataset files.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| dataset_type | text | 'dyslexia', 'adhd', 'dysgraphia' |
| subject_label | text | e.g., 'D01', 'N15' (dyslexic/non-dyslexic ID) |
| is_positive | boolean | true = has condition, false = control |
| features | jsonb | Extracted metrics (fixation durations, regression rates, chaos index, etc.) |
| source_upload_id | uuid | Links back to chunked_uploads |
| uploaded_by | uuid | Clinician who uploaded |
| created_at | timestamptz | Auto timestamp |

RLS: Users can read all profiles (reference data is shared), but only insert/update/delete their own.

### 2. Computed Thresholds Table
A `dataset_computed_thresholds` table to cache the statistically computed thresholds from reference profiles.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| dataset_type | text | 'dyslexia', 'adhd', 'dysgraphia' |
| metric_name | text | e.g., 'fixation_duration_avg', 'regression_rate' |
| positive_mean | numeric | Mean for positive (diagnosed) group |
| positive_std | numeric | Std deviation for positive group |
| negative_mean | numeric | Mean for control group |
| negative_std | numeric | Std deviation for control group |
| optimal_threshold | numeric | Computed optimal cutoff |
| weight | numeric | Computed feature importance |
| sample_size_positive | integer | Number of positive samples |
| sample_size_negative | integer | Number of negative samples |
| computed_at | timestamptz | When thresholds were last calculated |

RLS: Readable by all authenticated users. Only service role can write (via edge function).

### 3. Dataset Processing Edge Function (`process-dataset`)
A new edge function that:
1. Takes an upload ID and dataset type as input
2. Reads the uploaded files from storage (via the chunked upload system)
3. Parses the dataset files (CSV/JSON with handwriting feature data)
4. Extracts features per subject (fixation metrics, regression rates, handwriting scores)
5. Stores each subject's features as a row in `dataset_reference_profiles`
6. Recomputes statistical thresholds using positive vs. negative group comparison
7. Updates `dataset_computed_thresholds` with new optimal thresholds and weights

### 4. Enhanced DatasetUploader UI
Update the upload page to:
- Let users specify the **dataset type** (Dyslexia / ADHD / Dysgraphia) before upload
- Add a **"Process Dataset"** button that appears after upload completes
- Show processing status and results (number of profiles extracted, thresholds computed)
- Display a summary of computed thresholds vs. current hardcoded values

### 5. Data-Driven Diagnostic Engine
Modify the diagnostic engine to:
- On initialization, fetch computed thresholds from `dataset_computed_thresholds`
- If dataset-derived thresholds exist, use them instead of hardcoded defaults
- Fall back to hardcoded thresholds if no dataset has been processed yet
- Use a **nearest-neighbor comparison** against reference profiles for a secondary confidence score

## Architecture Flow

```text
Upload Dataset Files
       |
       v
Chunked Upload (existing) --> Storage bucket
       |
       v
"Process Dataset" button click
       |
       v
process-dataset Edge Function
  |-- Reads files from storage
  |-- Parses CSV/JSON features per subject
  |-- Stores in dataset_reference_profiles
  |-- Computes group statistics (positive vs negative)
  |-- Stores in dataset_computed_thresholds
       |
       v
Diagnostic Engine (enhanced)
  |-- Fetches computed thresholds on load
  |-- Uses data-driven thresholds for scoring
  |-- Compares new assessments against reference profiles
  |-- Produces more accurate probability indices
```

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/process-dataset/index.ts` | Edge function to parse dataset and compute thresholds |
| `src/hooks/useDatasetThresholds.ts` | Hook to fetch and manage dataset-derived thresholds |
| Migration SQL | Create `dataset_reference_profiles` and `dataset_computed_thresholds` tables |

## Files to Modify

| File | Change |
|------|---------|
| `src/components/dataset/DatasetUploader.tsx` | Add dataset type selector, process button, and results display |
| `src/pages/DatasetUpload.tsx` | Minor layout updates to accommodate new features |
| `src/lib/etdd70Engine.ts` | Accept dynamic thresholds from database instead of only hardcoded values |
| `src/hooks/useDiagnosticEngine.ts` | Integrate dataset thresholds into probability calculations |
| `src/hooks/useDyslexiaClassifier.ts` | Use data-driven weights when available |
| `supabase/config.toml` | Register the new `process-dataset` edge function |

## Technical Details

### Dataset File Format Support
The processing function will support:
- **CSV files**: Columns for subject ID, label (dyslexic/control), and metric values
- **JSON files**: Array of objects with subject data
- Standard column names: `subject_id`, `label`, `fixation_duration_avg`, `regression_rate`, `saccade_amplitude`, `chaos_index`, `reading_speed_wpm`, etc.

### Threshold Computation Algorithm
For each metric:
1. Separate data into positive (diagnosed) and negative (control) groups
2. Calculate mean and standard deviation for each group
3. Compute optimal threshold using the midpoint between group means, weighted by standard deviations
4. Calculate feature importance (weight) based on effect size (Cohen's d)
5. Store results for use by the diagnostic engine

### Fallback Strategy
- If no dataset has been processed, the system continues using hardcoded ETDD-70 thresholds (current behavior)
- Partial datasets work too: if only dyslexia data exists, only dyslexia thresholds are data-driven; ADHD/dysgraphia remain hardcoded
- A visual indicator in the dashboard shows whether thresholds are "data-driven" or "default"

### Future ADHD and Dysgraphia Support
The architecture is generic by design:
- `dataset_type` field supports 'dyslexia', 'adhd', 'dysgraphia'
- Each dataset type has its own set of relevant metrics and thresholds
- The processing function handles all three types with appropriate feature extraction
