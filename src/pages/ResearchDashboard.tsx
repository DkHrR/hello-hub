import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { DataQualityBadge, calculateCRAAPScore } from '@/components/dashboard/DataQualityBadge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database, FlaskConical, Loader2, TrendingUp } from 'lucide-react';

interface DatasetProfile {
  id: string;
  dataset_type: string;
  subject_label: string;
  is_positive: boolean;
  created_at: string;
  data_quality_score: any;
}

interface Threshold {
  metric_name: string;
  optimal_threshold: number;
  positive_mean: number;
  negative_mean: number;
  sample_size_positive: number;
  sample_size_negative: number;
  weight: number;
}

export default function ResearchDashboard() {
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<DatasetProfile[]>([]);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [dsRes, thRes] = await Promise.all([
        supabase.from('dataset_reference_profiles').select('id, dataset_type, subject_label, is_positive, created_at, data_quality_score').order('created_at', { ascending: false }).limit(100),
        supabase.from('dataset_computed_thresholds').select('*').order('metric_name'),
      ]);
      if (dsRes.data) setDatasets(dsRes.data as unknown as DatasetProfile[]);
      if (thRes.data) setThresholds(thRes.data as unknown as Threshold[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const datasetsByType = datasets.reduce<Record<string, { total: number; positive: number; negative: number }>>((acc, d) => {
    if (!acc[d.dataset_type]) acc[d.dataset_type] = { total: 0, positive: 0, negative: 0 };
    acc[d.dataset_type].total++;
    if (d.is_positive) acc[d.dataset_type].positive++;
    else acc[d.dataset_type].negative++;
    return acc;
  }, {});

  const datasetChartData = Object.entries(datasetsByType).map(([type, counts]) => ({
    type,
    positive: counts.positive,
    negative: counts.negative,
    total: counts.total,
  }));

  const thresholdChartData = thresholds.map(t => ({
    metric: t.metric_name.replace(/_/g, ' ').slice(0, 20),
    threshold: t.optimal_threshold,
    positiveMean: t.positive_mean,
    negativeMean: t.negative_mean,
    effectSize: t.positive_mean && t.negative_mean
      ? Math.abs(t.positive_mean - t.negative_mean) / Math.sqrt(((t.positive_mean ** 2) + (t.negative_mean ** 2)) / 2)
      : 0,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FlaskConical className="w-8 h-8 text-primary" />
              Research Dashboard
            </h1>
            <p className="text-muted-foreground">Dataset quality, threshold impact, and statistical analysis</p>
          </div>
          <Badge variant="outline">{datasets.length} datasets loaded</Badge>
        </div>

        {/* Dataset Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{datasets.length}</p>
                  <p className="text-xs text-muted-foreground">Total Reference Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-emerald-400" />
                <div>
                  <p className="text-2xl font-bold">{thresholds.length}</p>
                  <p className="text-xs text-muted-foreground">Computed Thresholds</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold">{Object.keys(datasetsByType).length}</p>
                  <p className="text-xs text-muted-foreground">Dataset Types</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Dataset Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Dataset Distribution</CardTitle>
              <CardDescription>Positive vs negative samples by dataset type</CardDescription>
            </CardHeader>
            <CardContent>
              {datasetChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datasetChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="type" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip />
                      <Bar dataKey="positive" name="Positive (Dyslexic)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="negative" name="Negative (Typical)" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">No datasets uploaded yet. Upload ETDD70 data to see analysis.</p>
              )}
            </CardContent>
          </Card>

          {/* Threshold Impact */}
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Thresholds</CardTitle>
              <CardDescription>Optimal threshold values by metric</CardDescription>
            </CardHeader>
            <CardContent>
              {thresholdChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={thresholdChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="threshold" name="Threshold" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="positiveMean" name="Positive Mean" stroke="#ef4444" strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="negativeMean" name="Negative Mean" stroke="#22c55e" strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">No thresholds computed yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Datasets with CRAAP Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Datasets & CRAAP Quality Scores</CardTitle>
            <CardDescription>Data reliability assessment for each reference profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Subject</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-center p-3 font-medium">Class</th>
                    <th className="text-center p-3 font-medium">Quality</th>
                    <th className="text-right p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.slice(0, 20).map(d => (
                    <tr key={d.id} className="border-t">
                      <td className="p-3">{d.subject_label}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{d.dataset_type}</Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant={d.is_positive ? 'default' : 'secondary'} className="text-xs">
                          {d.is_positive ? 'Dyslexic' : 'Typical'}
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <DataQualityBadge
                          score={d.data_quality_score || calculateCRAAPScore({
                            publicationYear: new Date(d.created_at).getFullYear(),
                            sampleSize: 70,
                            datasetType: d.dataset_type,
                          })}
                          showDetails
                        />
                      </td>
                      <td className="text-right p-3 text-muted-foreground text-xs">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {datasets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No datasets uploaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
