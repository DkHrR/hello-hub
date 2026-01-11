import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, Calendar, User } from 'lucide-react';

interface ProgressDataPoint {
  date: string;
  overallRisk: number;
  fluencyScore: number;
  visualScore: number;
  attentionScore: number;
}

interface StudentProgressChartProps {
  studentId?: string;
  className?: string;
}

export function StudentProgressChart({ studentId, className }: StudentProgressChartProps) {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState<ProgressDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | undefined>(studentId);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('90d');

  // Fetch students for dropdown - use correct column names
  useEffect(() => {
    async function fetchStudents() {
      if (!user) return;

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('created_by', user.id)
        .order('first_name');

      if (!error && data) {
        const formattedStudents = data.map(s => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name || ''}`.trim()
        }));
        setStudents(formattedStudents);
        if (!selectedStudent && formattedStudents.length > 0) {
          setSelectedStudent(formattedStudents[0].id);
        }
      }
    }

    fetchStudents();
  }, [user, selectedStudent]);

  // Fetch progress data for selected student using assessment_results via assessments
  useEffect(() => {
    async function fetchProgressData() {
      if (!selectedStudent) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Calculate date range
      let startDate = new Date();
      switch (timeRange) {
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      // Get assessment results for this student via assessments table
      const { data, error } = await supabase
        .from('assessment_results')
        .select(`
          created_at,
          overall_risk_score,
          reading_fluency_score,
          visual_processing_score,
          attention_score,
          assessments!inner (student_id)
        `)
        .eq('assessments.student_id', selectedStudent)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!error && data) {
        const formattedData: ProgressDataPoint[] = data.map((record: any) => {
          return {
            date: new Date(record.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }),
            overallRisk: record.overall_risk_score ?? 0,
            fluencyScore: record.reading_fluency_score ?? 0,
            visualScore: record.visual_processing_score ?? 0,
            attentionScore: record.attention_score ?? 0,
          };
        });
        
        setProgressData(formattedData);
      }

      setIsLoading(false);
    }

    fetchProgressData();
  }, [selectedStudent, timeRange]);

  const calculateTrend = (data: ProgressDataPoint[], key: keyof ProgressDataPoint): 'up' | 'down' | 'stable' => {
    if (data.length < 2) return 'stable';
    const firstValue = data[0][key] as number;
    const lastValue = data[data.length - 1][key] as number;
    const change = lastValue - firstValue;
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'up' : 'down';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Student Progress Over Time
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Student Selector */}
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-[180px]">
                <User className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Time Range Selector */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-1">
              <Calendar className="w-4 h-4 ml-2 text-muted-foreground" />
              {(['30d', '90d', '1y', 'all'] as const).map(range => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range === 'all' ? 'All' : range}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : progressData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No assessment data available yet.</p>
              <p className="text-sm">Complete an assessment to see progress over time.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Chart */}
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={progressData}>
                <defs>
                  <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fluencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="attentionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="overallRisk"
                  name="Risk Score"
                  stroke="hsl(var(--destructive))"
                  fill="url(#overallGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="fluencyScore"
                  name="Reading Fluency"
                  stroke="hsl(var(--primary))"
                  fill="url(#fluencyGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="attentionScore"
                  name="Attention"
                  stroke="hsl(var(--success))"
                  fill="url(#attentionGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Trend Indicators */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { 
                  key: 'overallRisk' as const, 
                  label: 'Risk Score', 
                  color: 'destructive',
                  goodDirection: 'down'
                },
                { 
                  key: 'fluencyScore' as const, 
                  label: 'Fluency', 
                  color: 'primary',
                  goodDirection: 'up'
                },
                { 
                  key: 'attentionScore' as const, 
                  label: 'Attention', 
                  color: 'success',
                  goodDirection: 'up'
                },
              ].map(item => {
                const trend = calculateTrend(progressData, item.key);
                const isPositive = (trend === 'down' && item.goodDirection === 'down') ||
                                   (trend === 'up' && item.goodDirection === 'up');
                const latestValue = progressData.length > 0 
                  ? progressData[progressData.length - 1][item.key] 
                  : 0;
                
                return (
                  <motion.div
                    key={item.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-lg border bg-${item.color}/5 border-${item.color}/20`}
                  >
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-2xl font-bold">
                        {(latestValue as number).toFixed(0)}%
                      </span>
                      <span className={`text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
                        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                        {trend !== 'stable' && (isPositive ? ' Improving' : ' Needs attention')}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}