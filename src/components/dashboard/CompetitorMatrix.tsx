import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trophy, Target } from 'lucide-react';

interface Competitor {
  id: string;
  competitor_name: string;
  sensitivity: number;
  specificity: number;
  auc_roc: number;
  multimodal_coverage: number;
  processing_speed: number;
}

const COLORS = ['hsl(var(--primary))', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899'];

export function CompetitorMatrix() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('competitor_benchmarks')
        .select('*')
        .order('sensitivity', { ascending: false });

      if (data) setCompetitors(data as unknown as Competitor[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const metrics = ['Sensitivity', 'Specificity', 'AUC-ROC', 'Multimodal', 'Speed'];
  const radarData = metrics.map((metric, i) => {
    const entry: Record<string, string | number> = { metric };
    competitors.forEach(c => {
      const values = [c.sensitivity, c.specificity, c.auc_roc * 100, c.multimodal_coverage, c.processing_speed];
      entry[c.competitor_name] = values[i];
    });
    return entry;
  });

  const neuroReadX = competitors.find(c => c.competitor_name === 'Neuro-Read X');

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Competitor Diagnostic Matrix
            </CardTitle>
            <CardDescription>Real-time accuracy benchmarking vs industry standards</CardDescription>
          </div>
          {neuroReadX && (
            <Badge className="bg-primary/10 text-primary border-primary/30 text-sm px-3 py-1">
              <Trophy className="w-4 h-4 mr-1" />
              #1 Overall
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                {competitors.map((c, i) => (
                  <Radar
                    key={c.id}
                    name={c.competitor_name}
                    dataKey={c.competitor_name}
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={c.competitor_name === 'Neuro-Read X' ? 0.25 : 0.05}
                    strokeWidth={c.competitor_name === 'Neuro-Read X' ? 2.5 : 1}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Benchmark Table</h4>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Platform</th>
                    <th className="text-center p-2 font-medium">Sens.</th>
                    <th className="text-center p-2 font-medium">Spec.</th>
                    <th className="text-center p-2 font-medium">AUC</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map(c => (
                    <tr key={c.id} className={c.competitor_name === 'Neuro-Read X' ? 'bg-primary/5 font-semibold' : ''}>
                      <td className="p-2 flex items-center gap-1">
                        {c.competitor_name === 'Neuro-Read X' && <Trophy className="w-3 h-3 text-primary" />}
                        {c.competitor_name}
                      </td>
                      <td className="text-center p-2">{c.sensitivity}%</td>
                      <td className="text-center p-2">{c.specificity}%</td>
                      <td className="text-center p-2">{c.auc_roc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">
                <strong className="text-primary">USP:</strong> "Assertive but Justifiable" — Neuro-Read X benchmarks against
                the ETDD70 dataset (7.2M clinical data points) for evidence-based diagnostics.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
