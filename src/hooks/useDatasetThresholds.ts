import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface DatasetThreshold {
  id: string;
  dataset_type: string;
  metric_name: string;
  positive_mean: number;
  positive_std: number;
  negative_mean: number;
  negative_std: number;
  optimal_threshold: number;
  weight: number;
  sample_size_positive: number;
  sample_size_negative: number;
  computed_at: string;
}

export interface ThresholdMap {
  [metricName: string]: DatasetThreshold;
}

export interface DatasetThresholdsState {
  dyslexia: ThresholdMap;
  adhd: ThresholdMap;
  dysgraphia: ThresholdMap;
  isLoaded: boolean;
  isDataDriven: {
    dyslexia: boolean;
    adhd: boolean;
    dysgraphia: boolean;
  };
}

export function useDatasetThresholds() {
  const [state, setState] = useState<DatasetThresholdsState>({
    dyslexia: {},
    adhd: {},
    dysgraphia: {},
    isLoaded: false,
    isDataDriven: { dyslexia: false, adhd: false, dysgraphia: false },
  });

  const fetchThresholds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dataset_computed_thresholds')
        .select('*');

      if (error) {
        logger.warn('Failed to fetch dataset thresholds', { error });
        setState(prev => ({ ...prev, isLoaded: true }));
        return;
      }

      const thresholds: DatasetThresholdsState = {
        dyslexia: {},
        adhd: {},
        dysgraphia: {},
        isLoaded: true,
        isDataDriven: { dyslexia: false, adhd: false, dysgraphia: false },
      };

      if (data) {
        for (const row of data) {
          const type = row.dataset_type as keyof typeof thresholds.isDataDriven;
          if (type === 'dyslexia' || type === 'adhd' || type === 'dysgraphia') {
            thresholds[type][row.metric_name] = row as DatasetThreshold;
            thresholds.isDataDriven[type] = true;
          }
        }
      }

      setState(thresholds);
      logger.info('Dataset thresholds loaded', {
        dyslexia: Object.keys(thresholds.dyslexia).length,
        adhd: Object.keys(thresholds.adhd).length,
        dysgraphia: Object.keys(thresholds.dysgraphia).length,
      });
    } catch (err) {
      logger.warn('Error fetching thresholds', { err });
      setState(prev => ({ ...prev, isLoaded: true }));
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  // Get a specific threshold value, falling back to a default
  const getThreshold = useCallback((
    datasetType: 'dyslexia' | 'adhd' | 'dysgraphia',
    metricName: string,
    fallback: number
  ): number => {
    const threshold = state[datasetType]?.[metricName];
    if (threshold) {
      return threshold.optimal_threshold;
    }
    return fallback;
  }, [state]);

  // Get the weight for a metric, falling back to a default
  const getWeight = useCallback((
    datasetType: 'dyslexia' | 'adhd' | 'dysgraphia',
    metricName: string,
    fallback: number
  ): number => {
    const threshold = state[datasetType]?.[metricName];
    if (threshold) {
      return threshold.weight;
    }
    return fallback;
  }, [state]);

  return {
    thresholds: state,
    isLoaded: state.isLoaded,
    isDataDriven: state.isDataDriven,
    getThreshold,
    getWeight,
    refetch: fetchThresholds,
  };
}
