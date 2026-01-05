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
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PDFReportGenerator } from '@/components/reports/PDFReportGenerator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import {
  ArrowLeft,
  User,
  Calendar,
  School,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Brain,
  Eye,
  Mic,
  PenTool,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';

interface StudentData {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  grade_level: string | null;
  school: string | null;
  notes: string | null;
  created_at: string;
}

interface AssessmentData {
  id: string;
  assessment_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  assessment_results: {
    overall_risk_score: number | null;
    reading_fluency_score: number | null;
    phonological_awareness_score: number | null;
    visual_processing_score: number | null;
    attention_score: number | null;
    recommendations: any;
    raw_data: any;
  }[];
}

interface InterventionData {
  id: string;
  intervention_type: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  effectiveness_rating: number | null;
  notes: string | null;
}

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [student, setStudent] = useState<StudentData | null>(null);
  const [assessments, setAssessments] = useState<AssessmentData[]>([]);
  const [interventions, setInterventions] = useState<InterventionData[]>([]);
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

      // Fetch assessments with results
      const { data: assessmentData } = await supabase
        .from('assessments')
        .select(`
          *,
          assessment_results (*)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (assessmentData) {
        setAssessments(assessmentData as unknown as AssessmentData[]);
      }

      // Fetch interventions
      const { data: interventionData } = await supabase
        .from('interventions')
        .select('*')
        .eq('student_id', studentId)
        .order('start_date', { ascending: false });

      if (interventionData) {
        setInterventions(interventionData);
      }

      setIsLoading(false);
    };

    fetchStudentData();
  }, [studentId, user, navigate]);

  // Calculate age from date of birth
  const calculateAge = (dob: string | null): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Get latest assessment result
  const getLatestResult = () => {
    const completed = assessments.filter(a => a.status === 'completed' && a.assessment_results.length > 0);
    if (completed.length === 0) return null;
    return completed[0].assessment_results[0];
  };

  // Prepare progress chart data
  const getProgressData = () => {
    return assessments
      .filter(a => a.status === 'completed' && a.assessment_results.length > 0)
      .slice(0, 10)
      .reverse()
      .map((a, index) => ({
        name: `Test ${index + 1}`,
        date: a.completed_at ? format(new Date(a.completed_at), 'MMM d') : 'N/A',
        fluency: a.assessment_results[0]?.reading_fluency_score ?? 0,
        phonological: a.assessment_results[0]?.phonological_awareness_score ?? 0,
        visual: a.assessment_results[0]?.visual_processing_score ?? 0,
        attention: a.assessment_results[0]?.attention_score ?? 0,
        risk: (a.assessment_results[0]?.overall_risk_score ?? 0) * 100
      }));
  };

  const getRiskBadge = (score: number | null) => {
    if (score === null) return <Badge variant="outline">Unknown</Badge>;
    if (score >= 0.6) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />High Risk</Badge>;
    if (score >= 0.3) return <Badge variant="outline" className="gap-1 border-warning text-warning">Moderate</Badge>;
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
                  <h1 className="text-3xl font-bold">
                    {student.first_name} {student.last_name}
                  </h1>
                  <div className="flex items-center gap-4 text-muted-foreground mt-1">
                    {student.grade_level && (
                      <span className="flex items-center gap-1">
                        <School className="w-4 h-4" />
                        {student.grade_level}
                      </span>
                    )}
                    {student.date_of_birth && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {calculateAge(student.date_of_birth)} years old
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getRiskBadge(latestResult?.overall_risk_score ?? null)}
                <Button variant="hero" onClick={() => navigate(`/assessment?studentId=${studentId}`)}>
                  <Plus className="w-4 h-4" />
                  New Assessment
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-lg">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="interventions">Interventions</TabsTrigger>
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
                        <p className="text-2xl font-bold">{assessments.length}</p>
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
                        <p className="text-2xl font-bold">{latestResult?.reading_fluency_score ?? 'N/A'}%</p>
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
                        <p className="text-sm text-muted-foreground">Attention</p>
                        <p className="text-2xl font-bold">{latestResult?.attention_score ?? 'N/A'}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10">
                        <Activity className="w-5 h-5 text-info" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Interventions</p>
                        <p className="text-2xl font-bold">{interventions.length}</p>
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
                          stackId="1"
                          stroke="hsl(var(--primary))"
                          fill="hsl(var(--primary) / 0.3)"
                          name="Reading Fluency"
                        />
                        <Area
                          type="monotone"
                          dataKey="phonological"
                          stackId="2"
                          stroke="hsl(var(--success))"
                          fill="hsl(var(--success) / 0.3)"
                          name="Phonological"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Latest Recommendations */}
              {latestResult?.recommendations && (
                <Card>
                  <CardHeader>
                    <CardTitle>Latest Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(Array.isArray(latestResult.recommendations) 
                        ? latestResult.recommendations 
                        : []
                      ).map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-success mt-1 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Assessments Tab */}
            <TabsContent value="assessments">
              <Card>
                <CardHeader>
                  <CardTitle>Assessment History</CardTitle>
                  <CardDescription>All assessments for this student</CardDescription>
                </CardHeader>
                <CardContent>
                  {assessments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No assessments yet</p>
                      <Button 
                        variant="hero" 
                        className="mt-4"
                        onClick={() => navigate(`/assessment?studentId=${studentId}`)}
                      >
                        Start First Assessment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {assessments.map((assessment) => (
                        <div
                          key={assessment.id}
                          className="p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{assessment.assessment_type}</Badge>
                                <Badge
                                  variant={
                                    assessment.status === 'completed'
                                      ? 'secondary'
                                      : assessment.status === 'in_progress'
                                        ? 'default'
                                        : 'outline'
                                  }
                                >
                                  {assessment.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {assessment.completed_at
                                  ? format(new Date(assessment.completed_at), 'PPp')
                                  : format(new Date(assessment.created_at), 'PPp')}
                              </p>
                            </div>
                            {assessment.assessment_results.length > 0 && (
                              <div className="text-right">
                                {getRiskBadge(assessment.assessment_results[0].overall_risk_score)}
                                <p className="text-sm text-muted-foreground mt-1">
                                  Fluency: {assessment.assessment_results[0].reading_fluency_score ?? 'N/A'}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="progress" className="space-y-6">
              {progressData.length < 2 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">
                      Need at least 2 completed assessments to show progress charts
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Score Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="risk"
                            stroke="hsl(var(--destructive))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--destructive))' }}
                            name="Risk %"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Skill Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={progressData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} />
                          <Tooltip />
                          <Bar dataKey="fluency" fill="hsl(var(--primary))" name="Fluency" />
                          <Bar dataKey="attention" fill="hsl(var(--warning))" name="Attention" />
                          <Bar dataKey="visual" fill="hsl(var(--success))" name="Visual" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Interventions Tab */}
            <TabsContent value="interventions">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Interventions</CardTitle>
                      <CardDescription>Track learning interventions and their effectiveness</CardDescription>
                    </div>
                    <Button variant="outline">
                      <Plus className="w-4 h-4" />
                      Add Intervention
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {interventions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No interventions recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {interventions.map((intervention) => (
                        <div
                          key={intervention.id}
                          className="p-4 rounded-lg border border-border"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-semibold">{intervention.intervention_type}</h4>
                              {intervention.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {intervention.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                {intervention.start_date && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Started: {format(new Date(intervention.start_date), 'PP')}
                                  </span>
                                )}
                              </div>
                            </div>
                            {intervention.effectiveness_rating && (
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Effectiveness</p>
                                <Progress value={intervention.effectiveness_rating * 20} className="w-24 mt-1" />
                                <p className="text-sm font-medium">{intervention.effectiveness_rating}/5</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
