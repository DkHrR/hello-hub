import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useSmtpVerification } from '@/hooks/useSmtpVerification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Brain, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyResetToken, isVerifying } = useSmtpVerification();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const resetToken = searchParams.get('reset_token');
  const email = searchParams.get('email');

  useEffect(() => {
    // If no reset token or email, redirect to auth
    if (!resetToken || !email) {
      toast.error('Invalid or missing reset link.');
      navigate('/auth');
    }
  }, [resetToken, email, navigate]);

  const validatePassword = (value: string) => {
    try {
      passwordSchema.parse(value);
      setErrors(prev => ({ ...prev, password: undefined }));
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, password: e.errors[0].message }));
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePassword(password)) return;
    
    if (password !== confirmPassword) {
      setErrors(prev => ({ ...prev, confirm: 'Passwords do not match' }));
      return;
    }
    setErrors(prev => ({ ...prev, confirm: undefined }));

    if (!resetToken || !email) {
      toast.error('Invalid reset link.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await verifyResetToken(resetToken, email, password);

      if (success) {
        setIsSuccess(true);
        // Redirect to auth page after 2 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!resetToken || !email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative">
              <Brain className="w-10 h-10 text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/30" />
            </div>
            <span className="text-2xl font-bold">
              Neuro-Read <span className="text-gradient-neuro">X</span>
            </span>
          </div>
        </div>

        <Card className="backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Reset Your Password
            </CardTitle>
            <CardDescription>
              Create a new secure password for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Password Updated!</h3>
                <p className="text-muted-foreground text-sm">
                  Redirecting you to sign in...
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => validatePassword(password)}
                      className="pl-10"
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Min 12 chars with uppercase, lowercase, number, and special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {errors.confirm && (
                    <p className="text-sm text-destructive">{errors.confirm}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting || isVerifying}>
                  {isSubmitting || isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
