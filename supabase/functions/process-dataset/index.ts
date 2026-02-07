import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Supported metrics for each dataset type
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

function parseCSV(text: string): SubjectRecord[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const records: SubjectRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted CSV values
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
      records.push(record as SubjectRecord);
    }
  }

  return records;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = claimsData.claims.sub as string;

    // Service client for writes
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

    // Option 1: Raw data sent directly (for smaller datasets or pre-read files)
    if (rawData) {
      console.log('[process-dataset] Parsing raw data...');
      // Try JSON first, then CSV
      records = parseJSON(rawData);
      if (records.length === 0) {
        records = parseCSV(rawData);
      }
    }
    // Option 2: Read from storage via upload ID
    else if (uploadId) {
      console.log(`[process-dataset] Reading from upload ${uploadId}`);

      // Get upload metadata
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

      // Read file from storage
      const storagePath = `${upload.storage_prefix}/${upload.file_name}`;
      const { data: fileData, error: fileErr } = await serviceClient.storage
        .from(upload.bucket_name)
        .download(storagePath);

      if (fileErr || !fileData) {
        // Try reading individual chunks and reassembling
        console.log('[process-dataset] Trying to read individual chunks...');
        const { data: chunks, error: chunksErr } = await serviceClient
          .from('upload_chunks')
          .select('*')
          .eq('upload_id', uploadId)
          .order('chunk_index', { ascending: true });

        if (chunksErr || !chunks?.length) {
          return new Response(JSON.stringify({ error: 'Could not read uploaded file or chunks' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Read and combine chunks
        const chunkContents: Uint8Array[] = [];
        for (const chunk of chunks) {
          const { data: chunkData, error: chunkErr } = await serviceClient.storage
            .from(upload.bucket_name)
            .download(chunk.storage_path);
          if (chunkErr || !chunkData) {
            console.error(`Failed to read chunk ${chunk.chunk_index}`);
            continue;
          }
          chunkContents.push(new Uint8Array(await chunkData.arrayBuffer()));
        }

        // Combine chunks
        const totalLength = chunkContents.reduce((sum, c) => sum + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunkContents) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const text = new TextDecoder().decode(combined);
        records = parseJSON(text);
        if (records.length === 0) {
          records = parseCSV(text);
        }
      } else {
        const text = await fileData.text();
        records = parseJSON(text);
        if (records.length === 0) {
          records = parseCSV(text);
        }
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
    let profilesInserted = 0;

    // Delete existing profiles for this upload/user/type combo to allow re-processing
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

    // Insert reference profiles
    const profilesToInsert = records.map(record => {
      const features: Record<string, number> = {};
      for (const key of metricKeys) {
        const val = record[key];
        if (val !== undefined && val !== '' && !isNaN(Number(val))) {
          features[key] = Number(val);
        }
      }
      // Also capture any numeric columns we didn't explicitly list
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

    // Insert in batches of 50
    for (let i = 0; i < profilesToInsert.length; i += 50) {
      const batch = profilesToInsert.slice(i, i + 50);
      const { error: insertErr } = await serviceClient
        .from('dataset_reference_profiles')
        .insert(batch);
      if (insertErr) {
        console.error('[process-dataset] Insert error:', insertErr);
      } else {
        profilesInserted += batch.length;
      }
    }

    console.log(`[process-dataset] Inserted ${profilesInserted} reference profiles`);

    // Compute thresholds from all profiles of this type
    const { data: allProfiles, error: profilesErr } = await serviceClient
      .from('dataset_reference_profiles')
      .select('*')
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

    const positiveProfiles = allProfiles.filter((p: { is_positive: boolean }) => p.is_positive);
    const negativeProfiles = allProfiles.filter((p: { is_positive: boolean }) => !p.is_positive);

    console.log(`[process-dataset] Computing thresholds: ${positiveProfiles.length} positive, ${negativeProfiles.length} negative`);

    // Collect all unique metric names across all profiles
    const allMetricNames = new Set<string>();
    for (const profile of allProfiles) {
      const features = profile.features as Record<string, number>;
      for (const key of Object.keys(features)) {
        allMetricNames.add(key);
      }
    }

    // Delete existing thresholds for this dataset type
    await serviceClient
      .from('dataset_computed_thresholds')
      .delete()
      .eq('dataset_type', datasetType);

    // Compute thresholds per metric
    const thresholds: Array<Record<string, unknown>> = [];

    for (const metric of allMetricNames) {
      const positiveValues = positiveProfiles
        .map((p: { features: Record<string, number> }) => p.features[metric])
        .filter((v: number | undefined): v is number => v !== undefined && !isNaN(v));
      const negativeValues = negativeProfiles
        .map((p: { features: Record<string, number> }) => p.features[metric])
        .filter((v: number | undefined): v is number => v !== undefined && !isNaN(v));

      if (positiveValues.length === 0 && negativeValues.length === 0) continue;

      const posStats = computeStats(positiveValues);
      const negStats = computeStats(negativeValues);

      // Optimal threshold: weighted midpoint between means
      const totalSamples = positiveValues.length + negativeValues.length;
      const posWeight = totalSamples > 0 ? positiveValues.length / totalSamples : 0.5;
      const negWeight = totalSamples > 0 ? negativeValues.length / totalSamples : 0.5;
      const optimalThreshold = posStats.mean * negWeight + negStats.mean * posWeight;

      // Weight = Cohen's d (effect size)
      const cohenD = computeCohenD(posStats.mean, posStats.std, negStats.mean, negStats.std);

      thresholds.push({
        dataset_type: datasetType,
        metric_name: metric,
        positive_mean: posStats.mean,
        positive_std: posStats.std,
        negative_mean: negStats.mean,
        negative_std: negStats.std,
        optimal_threshold: optimalThreshold,
        weight: Math.min(cohenD, 5), // Cap weight at 5
        sample_size_positive: positiveValues.length,
        sample_size_negative: negativeValues.length,
        computed_at: new Date().toISOString(),
      });
    }

    // Insert thresholds
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
      positiveCount: positiveProfiles.length,
      negativeCount: negativeProfiles.length,
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
      error: error instanceof Error ? error.message : 'Internal server error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
