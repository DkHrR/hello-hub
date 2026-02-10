import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { CompetitorMatrix } from '@/components/dashboard/CompetitorMatrix';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe, TrendingUp, Users, Target, Loader2 } from 'lucide-react';

export default function AdminAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      const [profiles, students, diagnostics] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('diagnostic_results').select('id', { count: 'exact', head: true }),
      ]);
      setUserCount(profiles.count || 0);
      setStudentCount(students.count || 0);
      setAssessmentCount(diagnostics.count || 0);
      setLoading(false);
    };
    fetchCounts();
  }, []);

  const tamSamSomData = [
    { name: 'TAM - Global Dyslexia Market', value: 4200, fill: 'hsl(var(--primary) / 0.2)' },
    { name: 'SAM - India K-12 Segment', value: 680, fill: 'hsl(var(--primary) / 0.5)' },
    { name: 'SOM - Current Reach', value: Math.max(userCount * 0.05, 0.5), fill: 'hsl(var(--primary))' },
  ];

  const marketBarData = [
    { segment: 'TAM', value: 4200, label: '$4.2B' },
    { segment: 'SAM', value: 680, label: '$680M' },
    { segment: 'SOM', value: Math.max(userCount * 50, 25), label: `$${Math.max(userCount * 50, 25).toLocaleString()}K` },
  ];

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
            <h1 className="text-3xl font-bold">Market Intelligence</h1>
            <p className="text-muted-foreground">TAM/SAM/SOM Analysis & Competitive Benchmarking</p>
          </div>
          <Badge variant="outline" className="text-xs">2027 Market Mind Forum</Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Users, label: 'Registered Clinicians', value: userCount, color: 'text-primary' },
            { icon: Target, label: 'Students Assessed', value: studentCount, color: 'text-emerald-400' },
            { icon: TrendingUp, label: 'Total Assessments', value: assessmentCount, color: 'text-blue-400' },
            { icon: Globe, label: 'TAM Size', value: '$4.2B', color: 'text-orange-400' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <kpi.icon className={`w-8 h-8 ${kpi.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* TAM/SAM/SOM */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Market Sizing (TAM/SAM/SOM)
              </CardTitle>
              <CardDescription>Dyslexia diagnostic market opportunity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tamSamSomData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={3}>
                      {tamSamSomData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="hsl(var(--border))" />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value >= 1000 ? (value / 1000).toFixed(1) + 'B' : value + 'M'}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Penetration Breakdown</CardTitle>
              <CardDescription>Revenue potential by segment ($ Millions)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marketBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="segment" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Competitor Matrix */}
        <CompetitorMatrix />
      </div>
    </div>
  );
}
