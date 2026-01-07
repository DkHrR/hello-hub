import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  FileText, 
  AlertTriangle, 
  TrendingUp,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MobileCard, MobileSection } from '@/components/layout/MobileLayout';

interface MobileDashboardProps {
  stats: {
    totalStudents: number;
    totalAssessments: number;
    highRiskCount: number;
    avgRiskScore: number;
  };
  students: Array<{
    id: string;
    name: string;
    grade: string;
    lastAssessment: string;
    risk: string;
  }>;
  isLoading: boolean;
}

export function MobileDashboard({ stats, students, isLoading }: MobileDashboardProps) {
  const navigate = useNavigate();

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'moderate': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats Grid */}
      <MobileSection>
        <h2 className="text-lg font-semibold mb-4">Overview</h2>
        <div className="grid grid-cols-2 gap-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-10" />
                </CardContent>
              </Card>
            ))
          ) : (
            [
              { label: 'Students', value: stats.totalStudents, icon: Users, color: 'primary' },
              { label: 'Assessments', value: stats.totalAssessments, icon: FileText, color: 'secondary' },
              { label: 'High Risk', value: stats.highRiskCount, icon: AlertTriangle, color: 'destructive' },
              { label: 'Active', value: Math.floor(stats.highRiskCount * 0.7), icon: TrendingUp, color: 'success' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <MobileCard>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `hsl(var(--${stat.color}) / 0.1)` }}
                    >
                      <stat.icon 
                        className="w-5 h-5" 
                        style={{ color: `hsl(var(--${stat.color}))` }}
                      />
                    </div>
                  </div>
                </MobileCard>
              </motion.div>
            ))
          )}
        </div>
      </MobileSection>

      {/* Quick Actions */}
      <MobileSection className="pt-0">
        <div className="flex gap-3">
          <Button 
            variant="hero" 
            className="flex-1"
            onClick={() => navigate('/assessment')}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Assessment
          </Button>
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate('/students')}
          >
            View All Students
          </Button>
        </div>
      </MobileSection>

      {/* Recent Students */}
      <MobileSection className="pt-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Students</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/students')}
          >
            See all
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : students.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No students yet</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => navigate('/students')}
                >
                  Add your first student
                </Button>
              </CardContent>
            </Card>
          ) : (
            students.slice(0, 5).map((student, i) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <MobileCard 
                  onClick={() => navigate(`/student/${student.id}`)}
                  className="flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.grade} • {student.lastAssessment}
                    </p>
                  </div>
                  <Badge variant={getRiskColor(student.risk) as any}>
                    {student.risk}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </MobileCard>
              </motion.div>
            ))
          )}
        </div>
      </MobileSection>

      {/* High Risk Alert */}
      {!isLoading && stats.highRiskCount > 0 && (
        <MobileSection className="pt-0">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-destructive">
                    {stats.highRiskCount} students need attention
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review high-risk profiles and consider interventions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MobileSection>
      )}
    </div>
  );
}
