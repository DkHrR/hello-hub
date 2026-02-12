import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const METRIC_KEYS: Record<string, string[]> = {
  dyslexia: [
    'fixation_duration_avg', 'regression_rate', 'saccade_amplitude',
    'chaos_index', 'reading_speed_wpm', 'prolonged_fixation_rate',
    'fixation_count', 'fic_score'
  ],
  adhd: [
    'chaos_index', 'attention_lapses', 'saccade_variability',
    'fixation_duration_avg', 'off_task_glances', 'reading_speed_wpm'
  ],
  dysgraphia: [
    'letter_reversal_count', 'letter_crowding', 'graphic_inconsistency',
    'line_adherence', 'stroke_pressure_variability', 'writing_speed'
  ],
};

interface SubjectRecord {
  subject_id: string;
  label: string;
  [key: string]: string | number | undefined;
}

function parseCSVLine(line: string, headers: string[]): SubjectRecord | null {
  if (!line.trim()) return null;
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  const record: Record<string, string | number | undefined> = {};
  headers.forEach((header, idx) => {
    const val = values[idx]?.replace(/['"]/g, '');
    const num = Number(val);
    record[header] = isNaN(num) || val === '' ? val : num;
  });

  if (record.subject_id !== undefined && record.label !== undefined) {
    return record as SubjectRecord;
  }
  return null;
}

function parseJSON(text: string): SubjectRecord[] {
  try {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : data.subjects || data.data || data.records || [];
    return arr.filter((r: Record<string, unknown>) => r.subject_id !== undefined && r.label !== undefined);
  } catch {
    return [];
  }
}

function isPositiveLabel(label: string): boolean {
  const lower = String(label).toLowerCase().trim();
  return ['dyslexic', 'positive', 'yes', '1', 'true', 'adhd', 'dysgraphia', 'd'].includes(lower) || lower.startsWith('d');
}

function computeStats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

function computeCohenD(posMean: number, posStd: number, negMean: number, negStd: number): number {
  const pooledStd = Math.sqrt((posStd * posStd + negStd * negStd) / 2);
  if (pooledStd === 0) return 0;
  return Math.abs(posMean - negMean) / pooledStd;
}

/**
 * Stream-parse chunks one at a time to avoid loading entire file into memory.
 * Each chunk is decoded, split into lines, and parsed individually.
 * Only the parsed records (small objects) are kept in memory.
 */
async function streamParseChunks(
  serviceClient: ReturnType<typeof createClient>,
  bucketName: string,
  chunks: Array<{ chunk_index: number; storage_path: string }>
): Promise<SubjectRecord[]> {
  const records: SubjectRecord[] = [];
  let headers: string[] | null = null;
  let leftover = ''; // Partial line from previous chunk

  for (const chunk of chunks) {
    const { data: chunkData, error: chunkErr } = await serviceClient.storage
      .from(bucketName)
      .download(chunk.storage_path);
    
    if (chunkErr || !chunkData) {
      console.error(`[process-dataset] Failed to read chunk ${chunk.chunk_index}`);
      continue;
    }

    // Decode this chunk and free the blob immediately
    const text = leftover + await chunkData.text();
    const lines = text.split('\n');
    
    // Last element might be incomplete - save for next chunk
    leftover = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (!headers) {
        // First non-empty line is the header
        headers = trimmed.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        continue;
      }

      const record = parseCSVLine(trimmed, headers);
      if (record) {
        records.push(record);
      }
    }
  }

  // Process any remaining leftover
  if (leftover.trim() && headers) {
    const record = parseCSVLine(leftover.trim(), headers);
    if (record) {
      records.push(record);
    }
  }

  return records;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = user.id;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { uploadId, datasetType, rawData } = body;

    if (!datasetType || !['dyslexia', 'adhd', 'dysgraphia'].includes(datasetType)) {
      return new Response(JSON.stringify({ error: 'Invalid dataset type. Must be dyslexia, adhd, or dysgraphia.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[process-dataset] Processing ${datasetType} dataset for user ${userId}`);

    let records: SubjectRecord[] = [];

    if (rawData) {
      console.log('[process-dataset] Parsing raw data...');
      records = parseJSON(rawData);
      if (records.length === 0) {
        // Parse CSV from raw string
        const lines = rawData.trim().split('\n');
        if (lines.length >= 2) {
          const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase().replace(/['"]/g, ''));
          for (let i = 1; i < lines.length; i++) {
            const record = parseCSVLine(lines[i], headers);
            if (record) records.push(record);
          }
        }
      }
    } else if (uploadId) {
      console.log(`[process-dataset] Reading from upload ${uploadId}`);

      const { data: upload, error: uploadErr } = await serviceClient
        .from('chunked_uploads')
        .select('*')
        .eq('id', uploadId)
        .single();

      if (uploadErr || !upload) {
        return new Response(JSON.stringify({ error: 'Upload not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Try reading the assembled file first (for small single-chunk uploads)
      const storagePath = `${upload.storage_prefix}/${upload.file_name}`;
      const { data: fileData, error: fileErr } = await serviceClient.storage
        .from(upload.bucket_name)
        .download(storagePath);

      if (!fileErr && fileData) {
        const text = await fileData.text();
        records = parseJSON(text);
        if (records.length === 0) {
          const lines = text.trim().split('\n');
          if (lines.length >= 2) {
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
            for (let i = 1; i < lines.length; i++) {
              const record = parseCSVLine(lines[i], headers);
              if (record) records.push(record);
            }
          }
        }
      } else {
        // Stream-parse chunks one at a time to stay within memory limits
        console.log('[process-dataset] Stream-parsing individual chunks...');
        const { data: chunks, error: chunksErr } = await serviceClient
          .from('upload_chunks')
          .select('chunk_index, storage_path')
          .eq('upload_id', uploadId)
          .order('chunk_index', { ascending: true });

        if (chunksErr || !chunks?.length) {
          return new Response(JSON.stringify({ error: 'Could not read uploaded file or chunks' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        records = await streamParseChunks(serviceClient, upload.bucket_name, chunks);
      }
    } else {
      return new Response(JSON.stringify({ error: 'Either uploadId or rawData is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[process-dataset] Parsed ${records.length} subject records`);

    if (records.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No valid records found. Ensure CSV/JSON has subject_id and label columns.' 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract features and store reference profiles
    const metricKeys = METRIC_KEYS[datasetType] || METRIC_KEYS.dyslexia;

    // Delete existing profiles
    if (uploadId) {
      await serviceClient
        .from('dataset_reference_profiles')
        .delete()
        .eq('source_upload_id', uploadId)
        .eq('uploaded_by', userId);
    } else {
      await serviceClient
        .from('dataset_reference_profiles')
        .delete()
        .eq('dataset_type', datasetType)
        .eq('uploaded_by', userId);
    }

    // Build and insert profiles in batches
    let profilesInserted = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE).map(record => {
        const features: Record<string, number> = {};
        for (const key of metricKeys) {
          const val = record[key];
          if (val !== undefined && val !== '' && !isNaN(Number(val))) {
            features[key] = Number(val);
          }
        }
        for (const [key, val] of Object.entries(record)) {
          if (key !== 'subject_id' && key !== 'label' && !features[key] && val !== undefined && val !== '' && !isNaN(Number(val))) {
            features[key] = Number(val);
          }
        }
        return {
          dataset_type: datasetType,
          subject_label: String(record.subject_id),
          is_positive: isPositiveLabel(String(record.label)),
          features,
          source_upload_id: uploadId || null,
          uploaded_by: userId,
        };
      });

      const { error: insertErr } = await serviceClient
        .from('dataset_reference_profiles')
        .insert(batch);
      if (insertErr) {
        console.error('[process-dataset] Insert error:', insertErr);
      } else {
        profilesInserted += batch.length;
      }
    }

    // Free records from memory
    records.length = 0;

    console.log(`[process-dataset] Inserted ${profilesInserted} reference profiles`);

    // Compute thresholds - fetch only needed columns
    const { data: allProfiles, error: profilesErr } = await serviceClient
      .from('dataset_reference_profiles')
      .select('is_positive, features')
      .eq('dataset_type', datasetType);

    if (profilesErr || !allProfiles?.length) {
      return new Response(JSON.stringify({
        success: true,
        profilesInserted,
        thresholdsComputed: 0,
        message: 'Profiles stored but could not compute thresholds'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Collect metric values incrementally without storing all profiles
    const allMetricNames = new Set<string>();
    const posValues: Record<string, number[]> = {};
    const negValues: Record<string, number[]> = {};

    for (const profile of allProfiles) {
      const features = profile.features as Record<string, number>;
      const isPos = profile.is_positive;
      for (const [key, val] of Object.entries(features)) {
        if (val === undefined || isNaN(val)) continue;
        allMetricNames.add(key);
        const target = isPos ? posValues : negValues;
        if (!target[key]) target[key] = [];
        target[key].push(val);
      }
    }

    // Delete existing thresholds
    await serviceClient
      .from('dataset_computed_thresholds')
      .delete()
      .eq('dataset_type', datasetType);

    const thresholds: Array<Record<string, unknown>> = [];

    for (const metric of allMetricNames) {
      const positiveValues = posValues[metric] || [];
      const negativeValues = negValues[metric] || [];

      if (positiveValues.length === 0 && negativeValues.length === 0) continue;

      const posStats = computeStats(positiveValues);
      const negStats = computeStats(negativeValues);

      const totalSamples = positiveValues.length + negativeValues.length;
      const posWeight = totalSamples > 0 ? positiveValues.length / totalSamples : 0.5;
      const negWeight = totalSamples > 0 ? negativeValues.length / totalSamples : 0.5;
      const optimalThreshold = posStats.mean * negWeight + negStats.mean * posWeight;

      const cohenD = computeCohenD(posStats.mean, posStats.std, negStats.mean, negStats.std);

      thresholds.push({
        dataset_type: datasetType,
        metric_name: metric,
        positive_mean: posStats.mean,
        positive_std: posStats.std,
        negative_mean: negStats.mean,
        negative_std: negStats.std,
        optimal_threshold: optimalThreshold,
        weight: Math.min(cohenD, 5),
        sample_size_positive: positiveValues.length,
        sample_size_negative: negativeValues.length,
        computed_at: new Date().toISOString(),
      });
    }

    let thresholdsComputed = 0;
    if (thresholds.length > 0) {
      const { error: threshErr } = await serviceClient
        .from('dataset_computed_thresholds')
        .insert(thresholds);
      if (threshErr) {
        console.error('[process-dataset] Threshold insert error:', threshErr);
      } else {
        thresholdsComputed = thresholds.length;
      }
    }

    console.log(`[process-dataset] Computed ${thresholdsComputed} thresholds`);

    return new Response(JSON.stringify({
      success: true,
      profilesInserted,
      thresholdsComputed,
      positiveCount: Object.values(posValues)[0]?.length || 0,
      negativeCount: Object.values(negValues)[0]?.length || 0,
      metrics: Array.from(allMetricNames),
      thresholdsSummary: thresholds.map(t => ({
        metric: t.metric_name,
        optimalThreshold: Number(t.optimal_threshold).toFixed(4),
        weight: Number(t.weight).toFixed(4),
        positiveMean: Number(t.positive_mean).toFixed(4),
        negativeMean: Number(t.negative_mean).toFixed(4),
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-dataset] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
