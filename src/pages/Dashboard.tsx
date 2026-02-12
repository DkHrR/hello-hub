import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// StudentProgressChart removed - this is a one-time assessment platform
import { GazeHeatmapReport } from '@/components/dashboard/GazeHeatmapReport';
import { AIInsightsPanel } from '@/components/reports/AIInsightsPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';
import { 
  Users, 
  Search, 
  Download, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Info,
  Filter,
  FileText,
  LogIn,
  Eye,
  BarChart3,
  Activity,
  Play,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user, loading: authLoading, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { students, stats, riskDistribution, isLoading, error, refetch, selfAssessments } = useDashboardData();
  const { isIndividual, hasClinicianAccess, isLoading: roleLoading } = useUserRole();
  
  // Real-time notifications - will auto-trigger toasts on new results
  useRealTimeNotifications();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);

  // Handle tab from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || student.risk === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary', icon: typeof CheckCircle }> = {
      low: { variant: 'secondary', icon: CheckCircle },
      moderate: { variant: 'outline', icon: Info },
      high: { variant: 'destructive', icon: AlertTriangle },
    };
    const { variant, icon: Icon } = variants[risk] || variants.low;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {risk.charAt(0).toUpperCase() + risk.slice(1)}
      </Badge>
    );
  };

  // Show login prompt if not authenticated
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <LogIn className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
              <p className="text-muted-foreground mb-6">
                Please sign in to access the dashboard and view your data.
              </p>
              <Button variant="hero" onClick={() => navigate('/auth')}>
                Sign In
              </Button>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Determine dashboard type based on role
  const dashboardTitle = isIndividual 
    ? 'Personal' 
    : hasClinicianAccess 
      ? 'Clinical' 
      : 'Personal';

  const dashboardDescription = isIndividual
    ? 'Your assessment history and insights'
    : hasClinicianAccess
      ? 'Student analytics and risk profiles'
      : 'Your assessment history and insights';

  // Get tabs based on role
  const getTabs = () => {
    if (isIndividual) {
      return [
        { value: 'overview', label: 'Overview', icon: BarChart3 },
        { value: 'history', label: 'Assessment History', icon: Clock },
        { value: 'reports', label: 'Reports & Insights', icon: Eye },
      ];
    }
    return [
      { value: 'overview', label: 'Overview', icon: BarChart3 },
      { value: 'students', label: 'Students', icon: Users },
      { value: 'history', label: 'Assessment History', icon: Activity },
      { value: 'reports', label: 'Reports', icon: Eye },
    ];
  };

  const tabs = getTabs();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {dashboardTitle}{' '}
                <span className="text-gradient-neuro">Dashboard</span>
              </h1>
              <p className="text-muted-foreground">
                {dashboardDescription}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {selfAssessments.length > 0 && (
                <Button variant="outline">
                  <Download className="w-4 h-4" />
                  Export Data
                </Button>
              )}
              <Link to="/assessment">
                <Button variant="hero">
                  <Play className="w-4 h-4" />
                  {isIndividual ? 'Take Assessment' : 'New Assessment'}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Dashboard Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className={`grid w-full max-w-md`} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`grid gap-4 ${isIndividual ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}
              >
                {isLoading || roleLoading ? (
                  Array.from({ length: isIndividual ? 3 : 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-16" />
                      </CardContent>
                    </Card>
                  ))
                ) : isIndividual ? (
                  // Individual user stats
                  [
                    { label: 'Total Assessments', value: selfAssessments.length.toString(), icon: FileText },
                    { label: 'Latest Risk Score', value: selfAssessments[0]?.dyslexia_probability_index !== null ? `${Math.round((Number(selfAssessments[0]?.dyslexia_probability_index) ?? 0) * 100)}%` : 'No data', icon: AlertTriangle },
                    { label: 'Last Assessed', value: selfAssessments[0] ? new Date(selfAssessments[0].created_at).toLocaleDateString() : 'Never', icon: Clock },
                  ].map((stat) => (
                    <Card key={stat.label}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <p className="text-2xl font-bold mt-1 capitalize">{stat.value}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-primary/10">
                            <stat.icon className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  // Clinician/Educator stats
                  [
                    { label: 'Total Students', value: stats.totalStudents.toString(), icon: Users },
                    { label: 'Assessments', value: stats.totalAssessments.toString(), icon: FileText },
                    { label: 'High Risk', value: stats.highRiskCount.toString(), icon: AlertTriangle },
                    { label: 'Moderate Risk', value: stats.moderateRiskCount?.toString() || '0', icon: TrendingUp },
                  ].map((stat) => (
                    <Card key={stat.label}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <p className="text-3xl font-bold mt-1">{stat.value}</p>
                          </div>
                          <div className="p-2 rounded-lg bg-primary/10">
                            <stat.icon className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </motion.div>

              {/* Risk Distribution - only for clinicians */}
              {!isIndividual && stats.totalStudents > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[200px] w-full" />
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={riskDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                dataKey="value"
                              >
                                {riskDistribution.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex justify-center gap-4 mt-4">
                            {riskDistribution.map((item) => (
                              <div key={item.name} className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                {item.name}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Latest Assessment Summary for individual users */}
              {isIndividual && selfAssessments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>Latest Assessment Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const latest = selfAssessments[0];
                        const dyslexia = Math.round((Number(latest.dyslexia_probability_index) ?? 0) * 100);
                        const adhd = Math.round((Number(latest.adhd_probability_index) ?? 0) * 100);
                        const dysgraphia = Math.round((Number(latest.dysgraphia_probability_index) ?? 0) * 100);
                        return (
                          <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-4">
                              {getRiskBadge(latest.overall_risk_level || 'low')}
                              <span className="text-sm text-muted-foreground">
                                {new Date(latest.created_at).toLocaleDateString('en-IN', {
                                  year: 'numeric', month: 'long', day: 'numeric'
                                })}
                              </span>
                            </div>
                            
                            {/* Probability Indices */}
                            <div className="grid gap-4">
                              {[
                                { label: 'Dyslexia Probability', value: dyslexia, color: 'bg-primary' },
                                { label: 'ADHD Probability', value: adhd, color: 'bg-warning' },
                                { label: 'Dysgraphia Probability', value: dysgraphia, color: 'bg-destructive' },
                              ].map((item) => (
                                <div key={item.label} className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{item.label}</span>
                                    <span className="font-semibold">{item.value}%</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${item.color}`}
                                      style={{ width: `${Math.min(item.value, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Key Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-lg font-bold">{latest.eye_total_fixations ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Fixations</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-lg font-bold">{latest.eye_regression_count ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Regressions</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-lg font-bold">{latest.voice_words_per_minute ?? 0}</p>
                                <p className="text-xs text-muted-foreground">WPM</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-lg font-bold">{latest.voice_fluency_score ?? 0}</p>
                                <p className="text-xs text-muted-foreground">Fluency</p>
                              </div>
                            </div>

                            <Button 
                              variant="outline" 
                              className="w-full"
                              onClick={() => {
                                setSelectedAssessment(latest);
                                setActiveTab('reports');
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Full Report & AI Insights
                            </Button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Empty state for individual users */}
              {isIndividual && selfAssessments.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Assessments Yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Take your first assessment to see your results and insights here.
                    </p>
                    <Link to="/assessment">
                      <Button variant="hero">
                        <Play className="w-4 h-4" />
                        Start Assessment
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Students Tab - Only for clinicians/educators */}
            {!isIndividual && (
              <TabsContent value="students">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <CardTitle>Student Risk Profiles</CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 w-64"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Filter className="w-4 h-4 text-muted-foreground" />
                          {(['all', 'low', 'medium', 'high'] as const).map((filter) => (
                            <Button
                              key={filter}
                              variant={selectedFilter === filter ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => setSelectedFilter(filter)}
                            >
                              {filter === 'medium' ? 'Moderate' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {students.length === 0 
                          ? "No students found. Add students to get started."
                          : "No students match your search criteria."
                        }
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Grade</th>
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Risk Level</th>
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Score</th>
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Last Assessed</th>
                              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((student) => (
                              <tr key={student.id} className="border-b border-border hover:bg-muted/50">
                                <td className="py-3 px-4 font-medium">{student.name}</td>
                                <td className="py-3 px-4">{student.grade}</td>
                                <td className="py-3 px-4">{getRiskBadge(student.risk)}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 rounded-full bg-muted">
                                      <div
                                        className={`h-full rounded-full ${
                                          student.risk === 'high' 
                                            ? 'bg-destructive' 
                                            : student.risk === 'medium'
                                              ? 'bg-warning'
                                              : 'bg-success'
                                        }`}
                                        style={{ width: `${Math.min(student.score, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-sm">{Math.round(student.score)}%</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">{student.lastAssessed}</td>
                                <td className="py-3 px-4">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setSelectedStudent(student.id)}
                                  >
                                    View Report
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Assessment History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Assessment History</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : selfAssessments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No assessment history yet.</p>
                      <Link to="/assessment" className="text-primary hover:underline mt-2 inline-block">
                        Take your first assessment
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selfAssessments.map((assessment: any) => (
                        <div 
                          key={assessment.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                            selectedAssessment?.id === assessment.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedAssessment(assessment)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                Session: {assessment.session_id}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(assessment.created_at).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Dyslexia Index</p>
                                <p className="font-bold">
                                  {(assessment.dyslexia_probability_index * 100).toFixed(0)}%
                                </p>
                              </div>
                              {getRiskBadge(assessment.overall_risk_level || 'low')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Progress chart removed - one-time assessment platform */}
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              {selectedAssessment ? (
                <>
                  <GazeHeatmapReport 
                    fixations={Array.isArray(selectedAssessment.fixation_data) ? selectedAssessment.fixation_data : []}
                    saccades={Array.isArray(selectedAssessment.saccade_data) ? selectedAssessment.saccade_data : []}
                  />
                  
                  {/* AI Insights Panel with real data from flat diagnostic_results columns */}
                  <AIInsightsPanel 
                    diagnosticResult={{
                      dyslexiaProbabilityIndex: Number(selectedAssessment.dyslexia_probability_index) ?? 0,
                      adhdProbabilityIndex: Number(selectedAssessment.adhd_probability_index) ?? 0,
                      dysgraphiaProbabilityIndex: Number(selectedAssessment.dysgraphia_probability_index) ?? 0,
                      overallRiskLevel: (selectedAssessment.overall_risk_level as 'low' | 'moderate' | 'high') ?? 'low',
                      eyeTracking: {
                        totalFixations: Number(selectedAssessment.eye_total_fixations) ?? 0,
                        averageFixationDuration: Number(selectedAssessment.eye_avg_fixation_duration) ?? 0,
                        regressionCount: Number(selectedAssessment.eye_regression_count) ?? 0,
                        prolongedFixations: Number(selectedAssessment.eye_prolonged_fixations) ?? 0,
                        chaosIndex: Number(selectedAssessment.eye_chaos_index) ?? 0,
                        fixationIntersectionCoefficient: Number(selectedAssessment.eye_fixation_intersection_coefficient) ?? 0,
                      },
                      voice: {
                        wordsPerMinute: Number(selectedAssessment.voice_words_per_minute) ?? 0,
                        pauseCount: Number(selectedAssessment.voice_pause_count) ?? 0,
                        averagePauseDuration: Number(selectedAssessment.voice_avg_pause_duration) ?? 0,
                        phonemicErrors: Number(selectedAssessment.voice_phonemic_errors) ?? 0,
                        fluencyScore: Number(selectedAssessment.voice_fluency_score) ?? 0,
                        prosodyScore: Number(selectedAssessment.voice_prosody_score) ?? 0,
                        stallCount: Number(selectedAssessment.voice_stall_count) ?? 0,
                        averageStallDuration: Number(selectedAssessment.voice_avg_stall_duration) ?? 0,
                        stallEvents: Array.isArray(selectedAssessment.voice_stall_events) ? selectedAssessment.voice_stall_events : [],
                      },
                      handwriting: {
                        reversalCount: Number(selectedAssessment.handwriting_reversal_count) ?? 0,
                        letterCrowding: Number(selectedAssessment.handwriting_letter_crowding) ?? 0,
                        graphicInconsistency: Number(selectedAssessment.handwriting_graphic_inconsistency) ?? 0,
                        lineAdherence: Number(selectedAssessment.handwriting_line_adherence) ?? 0,
                      },
                      cognitiveLoad: {
                        averagePupilDilation: Number(selectedAssessment.cognitive_avg_pupil_dilation) ?? 0,
                        overloadEvents: Number(selectedAssessment.cognitive_overload_events) ?? 0,
                        stressIndicators: Number(selectedAssessment.cognitive_stress_indicators) ?? 0,
                      },
                      timestamp: new Date(selectedAssessment.created_at),
                      sessionId: selectedAssessment.session_id ?? ''
                    }}
                  />
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Assessment Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Risk Level</p>
                          <p className="text-2xl font-bold capitalize">{selectedAssessment.overall_risk_level ?? 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Fluency Score</p>
                          <p className="text-2xl font-bold">{selectedAssessment.voice_fluency_score ?? 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Chaos Index</p>
                          <p className="text-2xl font-bold">{Number(selectedAssessment.eye_chaos_index ?? 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">WPM</p>
                          <p className="text-2xl font-bold">{selectedAssessment.voice_words_per_minute ?? 'N/A'}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : selfAssessments.length > 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">Select an Assessment</h3>
                    <p className="text-muted-foreground">
                      Choose an assessment from the History tab to view detailed reports and AI insights.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        setSelectedAssessment(selfAssessments[0]);
                        setActiveTab('history');
                      }}
                    >
                      View Latest Assessment
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No Reports Available</h3>
                    <p className="text-muted-foreground mb-6">
                      Complete an assessment to generate detailed reports and AI-powered insights.
                    </p>
                    <Link to="/assessment">
                      <Button variant="hero">
                        <Play className="w-4 h-4" />
                        Start Assessment
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
