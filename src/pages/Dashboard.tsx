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
import { StudentProgressChart } from '@/components/dashboard/StudentProgressChart';
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
                    { label: 'Latest Risk Score', value: selfAssessments[0]?.overall_risk_level ? selfAssessments[0].overall_risk_level : 'No data', icon: AlertTriangle },
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
                    { label: 'Interventions', value: Math.floor(stats.highRiskCount * 0.7).toString(), icon: TrendingUp },
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
              
              {/* Show longitudinal progress chart for clinicians */}
              {!isIndividual && <StudentProgressChart />}
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              {selectedAssessment ? (
                <>
                  <GazeHeatmapReport 
                    fixations={(selectedAssessment.assessment_results?.[0]?.raw_data as any)?.fixations || []}
                    saccades={(selectedAssessment.assessment_results?.[0]?.raw_data as any)?.saccades || []}
                  />
                  
                  {/* AI Insights Panel with real data */}
                  <AIInsightsPanel 
                    diagnosticResult={{
                      dyslexiaProbabilityIndex: selectedAssessment.assessment_results?.[0]?.dyslexia_biomarkers?.dyslexia_probability_index ?? 0,
                      adhdProbabilityIndex: selectedAssessment.assessment_results?.[0]?.dyslexia_biomarkers?.adhd_probability_index ?? 0,
                      dysgraphiaProbabilityIndex: selectedAssessment.assessment_results?.[0]?.dyslexia_biomarkers?.dysgraphia_probability_index ?? 0,
                      overallRiskLevel: selectedAssessment.assessment_results?.[0]?.dyslexia_biomarkers?.overall_risk_level ?? 'low',
                      eyeTracking: {
                        totalFixations: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.eyeTracking?.totalFixations ?? 0,
                        averageFixationDuration: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.eyeTracking?.averageFixationDuration ?? 0,
                        regressionCount: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.eyeTracking?.regressionCount ?? 0,
                        prolongedFixations: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.eyeTracking?.prolongedFixations ?? 0,
                        chaosIndex: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.eyeTracking?.chaosIndex ?? 0,
                        fixationIntersectionCoefficient: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.eyeTracking?.fixationIntersectionCoefficient ?? 0,
                      },
                      voice: {
                        wordsPerMinute: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.wordsPerMinute ?? 0,
                        pauseCount: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.pauseCount ?? 0,
                        averagePauseDuration: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.averagePauseDuration ?? 0,
                        phonemicErrors: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.phonemicErrors ?? 0,
                        fluencyScore: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.fluencyScore ?? 0,
                        prosodyScore: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.prosodyScore ?? 0,
                        stallCount: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.stallCount ?? 0,
                        averageStallDuration: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.averageStallDuration ?? 0,
                        stallEvents: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.voice?.stallEvents ?? [],
                      },
                      handwriting: {
                        reversalCount: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.handwriting?.reversalCount ?? 0,
                        letterCrowding: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.handwriting?.letterCrowding ?? 0,
                        graphicInconsistency: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.handwriting?.graphicInconsistency ?? 0,
                        lineAdherence: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.handwriting?.lineAdherence ?? 0,
                      },
                      cognitiveLoad: {
                        averagePupilDilation: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.cognitiveLoad?.averagePupilDilation ?? 0,
                        overloadEvents: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.cognitiveLoad?.overloadEvents ?? 0,
                        stressIndicators: (selectedAssessment.assessment_results?.[0]?.raw_data as any)?.cognitiveLoad?.stressIndicators ?? 0,
                      },
                      timestamp: new Date(selectedAssessment.created_at),
                      sessionId: selectedAssessment.assessment_results?.[0]?.dyslexia_biomarkers?.session_id ?? ''
                    }}
                  />
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Assessment Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Risk Score</p>
                          <p className="text-2xl font-bold">{selectedAssessment.assessment_results?.[0]?.overall_risk_score ?? 'N/A'}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Fluency Score</p>
                          <p className="text-2xl font-bold">{selectedAssessment.assessment_results?.[0]?.reading_fluency_score ?? 'N/A'}</p>
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
