import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  User,
  Calendar,
  School,
  TrendingUp,
  FileText,
  Brain,
  AlertTriangle,
  CheckCircle,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;
type DiagnosticResult = Tables<'diagnostic_results'>;

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!studentId || !user) return;

    const fetchStudentData = async () => {
      setIsLoading(true);

      // Fetch student
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (studentError) {
        console.error('Error fetching student:', studentError);
        navigate('/students');
        return;
      }

      setStudent(studentData);

      // Fetch diagnostic results for this student
      const { data: resultsData, error: resultsError } = await supabase
        .from('diagnostic_results')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (!resultsError && resultsData) {
        setDiagnosticResults(resultsData);
      }

      setIsLoading(false);
    };

    fetchStudentData();
  }, [studentId, user, navigate]);

  // Get latest result
  const getLatestResult = (): DiagnosticResult | null => {
    if (diagnosticResults.length === 0) return null;
    return diagnosticResults[0];
  };

  // Get risk level from result
  const getRiskLevel = (result: DiagnosticResult | null): string => {
    if (!result) return 'unknown';
    return result.overall_risk_level || 'low';
  };

  // Prepare progress chart data
  const getProgressData = () => {
    return diagnosticResults
      .slice(0, 10)
      .reverse()
      .map((result, index) => ({
        name: `Test ${index + 1}`,
        date: format(new Date(result.created_at), 'MMM d'),
        fluency: result.voice_fluency_score ?? 0,
        dyslexiaRisk: Math.round((result.dyslexia_probability_index ?? 0) * 100),
      }));
  };

  const getRiskBadge = (riskLevel: string) => {
    if (riskLevel === 'unknown') return <Badge variant="outline">Unknown</Badge>;
    if (riskLevel === 'high') return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />High Risk</Badge>;
    if (riskLevel === 'moderate') return <Badge variant="outline" className="gap-1 border-warning text-warning">Moderate</Badge>;
    return <Badge variant="secondary" className="gap-1 bg-success/10 text-success"><CheckCircle className="w-3 h-3" />Low Risk</Badge>;
  };

  const latestResult = getLatestResult();
  const progressData = getProgressData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container max-w-6xl">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container text-center">
            <h1 className="text-2xl font-bold">Student not found</h1>
            <Button onClick={() => navigate('/students')} className="mt-4">
              Back to Students
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container max-w-6xl">
          {/* Back button and header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Button variant="ghost" onClick={() => navigate('/students')} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Students
            </Button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-neuro flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{student.name}</h1>
                  <div className="flex items-center gap-4 text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <School className="w-4 h-4" />
                      Grade {student.grade || 'N/A'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {student.age} years old
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getRiskBadge(getRiskLevel(latestResult))}
                <Button variant="default" onClick={() => navigate(`/assessment?studentId=${studentId}`)}>
                  <Plus className="w-4 h-4" />
                  New Assessment
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Tests</p>
                        <p className="text-2xl font-bold">{diagnosticResults.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-success/10">
                        <TrendingUp className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Fluency Score</p>
                        <p className="text-2xl font-bold">{latestResult?.voice_fluency_score ?? 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/10">
                        <Brain className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dyslexia Risk</p>
                        <p className="text-2xl font-bold">
                          {latestResult?.dyslexia_probability_index 
                            ? `${Math.round(Number(latestResult.dyslexia_probability_index) * 100)}%` 
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10">
                        <Calendar className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Latest</p>
                        <p className="text-lg font-bold">
                          {latestResult 
                            ? format(new Date(latestResult.created_at), 'MMM d')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Chart */}
              {progressData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Progress Over Time</CardTitle>
                    <CardDescription>Assessment scores across multiple tests</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="fluency"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary) / 0.3)"
                          name="Fluency Score"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {student.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{student.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Assessments Tab */}
            <TabsContent value="assessments">
              <Card>
                <CardHeader>
                  <CardTitle>Assessment History</CardTitle>
                  <CardDescription>All assessment results for this student</CardDescription>
                </CardHeader>
                <CardContent>
                  {diagnosticResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No assessments yet</p>
                      <Button 
                        variant="default" 
                        className="mt-4"
                        onClick={() => navigate(`/assessment?studentId=${studentId}`)}
                      >
                        Start First Assessment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {diagnosticResults.map((result) => (
                        <div
                          key={result.id}
                          className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{result.session_id.slice(0, 8)}</Badge>
                                {getRiskBadge(result.overall_risk_level || 'low')}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {format(new Date(result.created_at), 'PPp')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Dyslexia Risk</p>
                              <p className="text-lg font-bold">
                                {result.dyslexia_probability_index 
                                  ? `${Math.round(Number(result.dyslexia_probability_index) * 100)}%`
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="progress">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Analysis</CardTitle>
                  <CardDescription>Track improvement over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {progressData.length < 2 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Need at least 2 assessments to show progress</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="fluency"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary) / 0.3)"
                          name="Fluency Score"
                        />
                        <Area
                          type="monotone"
                          dataKey="dyslexiaRisk"
                          stroke="hsl(var(--destructive))"
                          fill="hsl(var(--destructive) / 0.2)"
                          name="Dyslexia Risk %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
