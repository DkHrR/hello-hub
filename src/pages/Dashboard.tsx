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
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useRealTimeNotifications } from '@/hooks/useRealTimeNotifications';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
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
  Activity
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { students, stats, riskDistribution, isLoading, error, refetch } = useDashboardData();
  
  // Real-time notifications - will auto-trigger toasts on new results
  useRealTimeNotifications();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

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

  // Chart data
  const gradeData = [
    { grade: 'K', low: 70, moderate: 20, high: 10 },
    { grade: '1st', low: 65, moderate: 25, high: 10 },
    { grade: '2nd', low: 60, moderate: 28, high: 12 },
    { grade: '3rd', low: 68, moderate: 22, high: 10 },
    { grade: '4th', low: 72, moderate: 20, high: 8 },
    { grade: '5th', low: 75, moderate: 18, high: 7 },
  ];

  const trendData = [
    { month: 'Jan', assessments: 120, identified: 15 },
    { month: 'Feb', assessments: 145, identified: 18 },
    { month: 'Mar', assessments: 180, identified: 22 },
    { month: 'Apr', assessments: 210, identified: 25 },
    { month: 'May', assessments: 250, identified: 28 },
    { month: 'Jun', assessments: 190, identified: 20 },
  ];

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
                Please sign in to access the dashboard and view student data.
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
                {profile?.organization === 'School (India K-12)' ? 'School' : 
                 profile?.organization === 'Pediatrician' ? 'Clinical' : 'Personal'}{' '}
                <span className="text-gradient-neuro">Dashboard</span>
              </h1>
              <p className="text-muted-foreground">
                {profile?.organization === 'School (India K-12)' 
                  ? 'School-wide analytics and student risk profiles'
                  : profile?.organization === 'Pediatrician'
                    ? 'Clinical patient assessments and diagnostic reports'
                    : 'Your assessment history and progress tracking'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline">
                <Download className="w-4 h-4" />
                Export Data
              </Button>
              <Button variant="hero">
                <FileText className="w-4 h-4" />
                Generate Report
              </Button>
            </div>
          </motion.div>

          {/* Dashboard Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-md">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-2">
                <Users className="w-4 h-4" />
                Students
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-2">
                <Activity className="w-4 h-4" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <Eye className="w-4 h-4" />
                Reports
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-16" />
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  [
                    { label: 'Total Students', value: stats.totalStudents.toString(), icon: Users, change: '+12%' },
                    { label: 'Assessments', value: stats.totalAssessments.toString(), icon: FileText, change: '+8%' },
                    { label: 'High Risk', value: stats.highRiskCount.toString(), icon: AlertTriangle, change: '-5%' },
                    { label: 'Interventions', value: Math.floor(stats.highRiskCount * 0.7).toString(), icon: TrendingUp, change: '+15%' },
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
                        <p className={`text-sm mt-2 ${stat.change.startsWith('+') ? 'text-success' : 'text-destructive'}`}>
                          {stat.change} from last month
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </motion.div>

              {/* Charts Row */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid md:grid-cols-3 gap-6"
              >
                {/* Risk Distribution Pie */}
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

                {/* Grade Distribution Bar */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Risk by Grade Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={gradeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="grade" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="low" stackId="a" fill="hsl(var(--success))" />
                        <Bar dataKey="moderate" stackId="a" fill="hsl(var(--warning))" />
                        <Bar dataKey="high" stackId="a" fill="hsl(var(--destructive))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Trend Line Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Assessment Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="assessments" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="identified" 
                          stroke="hsl(var(--destructive))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--destructive))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        Total Assessments
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-destructive" />
                        High Risk Identified
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Students Tab */}
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
                                      style={{ width: `${Math.min(student.score * 100, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-sm">{Math.round(student.score * 100)}%</span>
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

            {/* Progress Tab - Longitudinal Tracking */}
            <TabsContent value="progress">
              <StudentProgressChart />
            </TabsContent>

            {/* Reports Tab - Gaze Heatmaps */}
            <TabsContent value="reports">
              <GazeHeatmapReport 
                fixations={[]}
                saccades={[]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
