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

/** Welford's online algorithm for incremental mean/variance */
interface RunningStats {
  n: number;
  mean: number;
  m2: number;
}

function newStats(): RunningStats {
  return { n: 0, mean: 0, m2: 0 };
}

function pushStat(s: RunningStats, x: number) {
  s.n++;
  const delta = x - s.mean;
  s.mean += delta / s.n;
  s.m2 += delta * (x - s.mean);
}

function finalizeStats(s: RunningStats): { mean: number; std: number } {
  if (s.n === 0) return { mean: 0, std: 0 };
  return { mean: s.mean, std: Math.sqrt(s.m2 / s.n) };
}

function parseCSVLine(line: string, headers: string[]): SubjectRecord | null {
  if (!line.trim()) return null;
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
    else { current += char; }
  }
  values.push(current.trim());

  const record: Record<string, string | number | undefined> = {};
  for (let idx = 0; idx < headers.length; idx++) {
    const val = values[idx]?.replace(/['"]/g, '');
    const num = Number(val);
    record[headers[idx]] = isNaN(num) || val === '' ? val : num;
  }

  if (record.subject_id !== undefined && record.label !== undefined) {
    return record as SubjectRecord;
  }
  return null;
}

function isPositiveLabel(label: string): boolean {
  const lower = String(label).toLowerCase().trim();
  return ['dyslexic', 'positive', 'yes', '1', 'true', 'adhd', 'dysgraphia', 'd'].includes(lower) || lower.startsWith('d');
}

function computeCohenD(posMean: number, posStd: number, negMean: number, negStd: number): number {
  const pooledStd = Math.sqrt((posStd * posStd + negStd * negStd) / 2);
  if (pooledStd === 0) return 0;
  return Math.abs(posMean - negMean) / pooledStd;
}

/**
 * Accumulator that tracks running stats per metric and inserts profiles in batches.
 * No large arrays are kept — stats use Welford's online algorithm.
 */
class IncrementalProcessor {
  private posStats: Record<string, RunningStats> = {};
  private negStats: Record<string, RunningStats> = {};
  private batch: Array<Record<string, unknown>> = [];
  private profilesInserted = 0;
  private readonly BATCH_SIZE = 100;

  constructor(
    private serviceClient: ReturnType<typeof createClient>,
    private datasetType: string,
    private metricKeys: string[],
    private uploadId: string | null,
    private userId: string,
  ) {}

  /** Process a single parsed record: extract features, update stats, buffer for insert */
  addRecord(record: SubjectRecord) {
    const features: Record<string, number> = {};
    for (const key of this.metricKeys) {
      const val = record[key];
      if (val !== undefined && val !== '' && !isNaN(Number(val))) {
        features[key] = Number(val);
      }
    }
    for (const [key, val] of Object.entries(record)) {
      if (key === 'subject_id' || key === 'label') continue;
      if (features[key] !== undefined) continue;
      if (val !== undefined && val !== '' && !isNaN(Number(val))) {
        features[key] = Number(val);
      }
    }

    const isPos = isPositiveLabel(String(record.label));
    const statsMap = isPos ? this.posStats : this.negStats;
    for (const [k, v] of Object.entries(features)) {
      if (!statsMap[k]) statsMap[k] = newStats();
      pushStat(statsMap[k], v);
    }

    this.batch.push({
      dataset_type: this.datasetType,
      subject_label: String(record.subject_id),
      is_positive: isPos,
      features,
      source_upload_id: this.uploadId,
      uploaded_by: this.userId,
    });

    if (this.batch.length >= this.BATCH_SIZE) {
      return this.flushBatch();
    }
    return Promise.resolve();
  }

  private async flushBatch() {
    if (this.batch.length === 0) return;
    const toInsert = this.batch.splice(0);
    const { error } = await this.serviceClient
      .from('dataset_reference_profiles')
      .insert(toInsert);
    if (error) {
      console.error('[process-dataset] Insert error:', error.message);
    } else {
      this.profilesInserted += toInsert.length;
    }
  }

  async finish() {
    await this.flushBatch();
    return this.profilesInserted;
  }

  /** Compute thresholds from the running stats — no DB re-fetch needed */
  computeThresholds(): Array<Record<string, unknown>> {
    const allMetrics = new Set([
      ...Object.keys(this.posStats),
      ...Object.keys(this.negStats),
    ]);
    const thresholds: Array<Record<string, unknown>> = [];

    for (const metric of allMetrics) {
      const ps = finalizeStats(this.posStats[metric] || newStats());
      const ns = finalizeStats(this.negStats[metric] || newStats());
      const pn = (this.posStats[metric]?.n || 0);
      const nn = (this.negStats[metric]?.n || 0);
      if (pn === 0 && nn === 0) continue;

      const total = pn + nn;
      const posWeight = total > 0 ? pn / total : 0.5;
      const negWeight = total > 0 ? nn / total : 0.5;
      const optimalThreshold = ps.mean * negWeight + ns.mean * posWeight;
      const cohenD = computeCohenD(ps.mean, ps.std, ns.mean, ns.std);

      thresholds.push({
        dataset_type: this.datasetType,
        metric_name: metric,
        positive_mean: ps.mean,
        positive_std: ps.std,
        negative_mean: ns.mean,
        negative_std: ns.std,
        optimal_threshold: optimalThreshold,
        weight: Math.min(cohenD, 5),
        sample_size_positive: pn,
        sample_size_negative: nn,
        computed_at: new Date().toISOString(),
      });
    }
    return thresholds;
  }

  get posCount() { return Object.values(this.posStats)[0]?.n || 0; }
  get negCount() { return Object.values(this.negStats)[0]?.n || 0; }
  get metrics() { return new Set([...Object.keys(this.posStats), ...Object.keys(this.negStats)]); }
}

/**
 * Parse a text source line-by-line, feeding each record to the processor.
 * Works for both assembled files and individual chunks.
 */
function processCSVText(
  text: string,
  headers: string[] | null,
  processor: IncrementalProcessor,
  promises: Promise<void>[],
): string[] | null {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!headers) {
      headers = trimmed.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      continue;
    }
    const record = parseCSVLine(trimmed, headers);
    if (record) {
      promises.push(processor.addRecord(record));
    }
  }
  return headers;
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
      return new Response(JSON.stringify({ error: 'Invalid dataset type.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[process-dataset] Processing ${datasetType} dataset for user ${userId}`);

    const metricKeys = METRIC_KEYS[datasetType] || METRIC_KEYS.dyslexia;
    const processor = new IncrementalProcessor(serviceClient, datasetType, metricKeys, uploadId || null, userId);
    const insertPromises: Promise<void>[] = [];

    // Delete existing profiles first
    if (uploadId) {
      await serviceClient.from('dataset_reference_profiles').delete()
        .eq('source_upload_id', uploadId).eq('uploaded_by', userId);
    } else {
      await serviceClient.from('dataset_reference_profiles').delete()
        .eq('dataset_type', datasetType).eq('uploaded_by', userId);
    }

    let totalParsed = 0;

    if (rawData) {
      // Try JSON first
      try {
        const data = JSON.parse(rawData);
        const arr = Array.isArray(data) ? data : data.subjects || data.data || data.records || [];
        for (const r of arr) {
          if (r.subject_id !== undefined && r.label !== undefined) {
            insertPromises.push(processor.addRecord(r as SubjectRecord));
            totalParsed++;
          }
        }
      } catch {
        // Fall back to CSV
        processCSVText(rawData, null, processor, insertPromises);
        totalParsed = insertPromises.length;
      }
    } else if (uploadId) {
      const { data: upload, error: uploadErr } = await serviceClient
        .from('chunked_uploads').select('*').eq('id', uploadId).single();

      if (uploadErr || !upload) {
        return new Response(JSON.stringify({ error: 'Upload not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Try assembled file first
      const storagePath = `${upload.storage_prefix}/${upload.file_name}`;
      const { data: fileData, error: fileErr } = await serviceClient.storage
        .from(upload.bucket_name).download(storagePath);

      if (!fileErr && fileData) {
        const text = await fileData.text();
        // Try JSON
        try {
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data : data.subjects || data.data || data.records || [];
          for (const r of arr) {
            if (r.subject_id !== undefined && r.label !== undefined) {
              insertPromises.push(processor.addRecord(r as SubjectRecord));
              totalParsed++;
            }
          }
        } catch {
          processCSVText(text, null, processor, insertPromises);
        }
      } else {
        // Stream chunks one at a time
        console.log('[process-dataset] Stream-parsing individual chunks...');
        const { data: chunks, error: chunksErr } = await serviceClient
          .from('upload_chunks').select('chunk_index, storage_path')
          .eq('upload_id', uploadId).order('chunk_index', { ascending: true });

        if (chunksErr || !chunks?.length) {
          return new Response(JSON.stringify({ error: 'Could not read uploaded file or chunks' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let headers: string[] | null = null;
        let leftover = '';

        for (const chunk of chunks) {
          const { data: chunkData, error: chunkErr } = await serviceClient.storage
            .from(upload.bucket_name).download(chunk.storage_path);
          if (chunkErr || !chunkData) continue;

          const text = leftover + await chunkData.text();
          const lines = text.split('\n');
          leftover = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (!headers) {
              headers = trimmed.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
              continue;
            }
            const record = parseCSVLine(trimmed, headers);
            if (record) {
              // Await each batch flush inline to limit concurrency
              await processor.addRecord(record);
              totalParsed++;
            }
          }
        }

        if (leftover.trim() && headers) {
          const record = parseCSVLine(leftover.trim(), headers);
          if (record) {
            await processor.addRecord(record);
            totalParsed++;
          }
        }
      }
    } else {
      return new Response(JSON.stringify({ error: 'Either uploadId or rawData is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Wait for any remaining batch inserts
    await Promise.all(insertPromises);
    const profilesInserted = await processor.finish();

    console.log(`[process-dataset] Inserted ${profilesInserted} profiles`);

    // Compute thresholds from running stats (no DB re-fetch!)
    const thresholds = processor.computeThresholds();

    await serviceClient.from('dataset_computed_thresholds').delete().eq('dataset_type', datasetType);

    let thresholdsComputed = 0;
    if (thresholds.length > 0) {
      const { error: threshErr } = await serviceClient
        .from('dataset_computed_thresholds').insert(thresholds);
      if (threshErr) {
        console.error('[process-dataset] Threshold insert error:', threshErr.message);
      } else {
        thresholdsComputed = thresholds.length;
      }
    }

    console.log(`[process-dataset] Computed ${thresholdsComputed} thresholds`);

    return new Response(JSON.stringify({
      success: true,
      profilesInserted,
      thresholdsComputed,
      positiveCount: processor.posCount,
      negativeCount: processor.negCount,
      metrics: Array.from(processor.metrics),
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
