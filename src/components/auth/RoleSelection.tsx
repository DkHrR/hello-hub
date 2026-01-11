import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, School, Stethoscope, CheckCircle, ArrowRight } from 'lucide-react';

export type UserRole = 'individual' | 'school' | 'pediatrician';

interface RoleSelectionProps {
  onRoleSelect: (role: UserRole) => void;
  userName?: string;
}

const roles = [
  {
    id: 'individual' as UserRole,
    icon: User,
    title: 'Individual',
    description: 'Parent or guardian seeking assessment for a child',
    features: ['Single child assessment', 'Personal dashboard', 'PDF reports']
  },
  {
    id: 'school' as UserRole,
    icon: School,
    title: 'School (India K-12)',
    description: 'Educational institution conducting mass screenings',
    features: ['Bulk student management', 'School-wide analytics', 'Intervention tracking']
  },
  {
    id: 'pediatrician' as UserRole,
    icon: Stethoscope,
    title: 'Pediatrician',
    description: 'Healthcare professional providing clinical assessments',
    features: ['Clinical diagnostic tools', 'Patient records', 'Referral management']
  }
];

export function RoleSelection({ onRoleSelect, userName }: RoleSelectionProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto p-4"
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome{userName ? `, ${userName}` : ''}!
        </h1>
        <p className="text-muted-foreground">
          Please select your role to personalize your experience
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {roles.map((role, index) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={`cursor-pointer transition-all duration-300 h-full ${
                selectedRole === role.id
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                  : 'hover:border-primary/50 hover:shadow-lg'
              }`}
              onClick={() => setSelectedRole(role.id)}
            >
              <CardHeader className="text-center pb-2">
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${
                    selectedRole === role.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <role.icon className="w-8 h-8" />
                </div>
                <CardTitle className="text-xl">{role.title}</CardTitle>
                <CardDescription className="text-sm">
                  {role.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {role.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`w-4 h-4 ${
                        selectedRole === role.id ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <Button
          variant="hero"
          size="xl"
          disabled={!selectedRole}
          onClick={handleContinue}
        >
          Continue to Dashboard
          <ArrowRight className="w-5 h-5" />
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Role selection is permanent. Contact support if you need to change it.
        </p>
      </div>
    </motion.div>
  );
}
