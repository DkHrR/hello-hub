import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoleSelection } from '@/components/auth/RoleSelection';
import { toast } from 'sonner';
import { Brain, Mail, Lock, User, Loader2, ArrowLeft } from 'lucide-react';
import { useUserRole, UI_ROLE_TO_DB_ROLE, type AppRole } from '@/hooks/useUserRole';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

type UserRole = 'individual' | 'school' | 'pediatrician';

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithMagicLink, signInWithGoogle, resetPassword, loading, profile } = useAuth();
  const { hasAnyRole, setRole, isSettingRole, isLoading: isRoleLoading } = useUserRole();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; email: string; name: string } | null>(null);

  useEffect(() => {
    if (user && !loading && !isRoleLoading) {
      // Check if user has a role in the user_roles table (server-side check)
      if (hasAnyRole()) {
        // User has a role, go to dashboard
        navigate('/dashboard');
      } else if (user) {
        // User exists but no role - show role selection
        setPendingUser({
          id: user.id,
          email: user.email || '',
          name: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || ''
        });
        setShowRoleSelection(true);
      }
    }
  }, [user, loading, isRoleLoading, hasAnyRole, profile, navigate]);

  const validateEmail = (value: string) => {
    try {
      emailSchema.parse(value);
      setErrors(prev => ({ ...prev, email: undefined }));
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, email: e.errors[0].message }));
      }
      return false;
    }
  };

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

  const handleRoleSelect = async (role: UserRole) => {
    if (!pendingUser) return;
    
    // Map UI role to database role
    const dbRole: AppRole = UI_ROLE_TO_DB_ROLE[role];
    
    // Map role to display text for toast
    const roleDisplayMap: Record<UserRole, string> = {
      individual: 'Individual',
      school: 'School (India K-12)',
      pediatrician: 'Pediatrician'
    };
    
    try {
      // Use the secure RPC function to set role server-side
      await setRole(dbRole);
      toast.success(`Welcome! You're registered as ${roleDisplayMap[role]}`);
      navigate('/dashboard');
    } catch (error) {
      // Error is already handled by the mutation
      console.error('Role selection failed:', error);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email) || !validatePassword(password)) return;
    
    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);
    
    if (error) {
      // Use generic error message to prevent account enumeration
      console.error('Sign in error:', error.message);
      toast.error('Unable to sign in. Please check your credentials and try again.');
    } else {
      toast.success('Welcome back!');
      // Role check happens in useEffect
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email) || !validatePassword(password)) return;
    if (!fullName.trim()) {
      setErrors(prev => ({ ...prev, fullName: 'Please enter your full name' }));
      return;
    }
    
    setIsSubmitting(true);
    const { error } = await signUp(email, password, fullName);
    setIsSubmitting(false);
    
    if (error) {
      // Use generic error message to prevent account enumeration
      console.error('Sign up error:', error.message);
      toast.error('Unable to create account. Please try again or use a different email.');
    } else {
      toast.success('Account created! Please select your role.');
      // Role selection will trigger via useEffect
    }
  };

  const handleMagicLink = async () => {
    if (!validateEmail(email)) return;
    
    setIsSubmitting(true);
    const { error } = await signInWithMagicLink(email);
    setIsSubmitting(false);
    
    if (error) {
      toast.error(error.message || 'Failed to send magic link');
    } else {
      toast.success('Check your email for the login link!');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message || 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
    // Role check will happen after OAuth redirect via useEffect
  };

  const handleBackToEmailLogin = () => {
    setShowForgotPassword(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;
    
    setIsSubmitting(true);
    const { error } = await resetPassword(email);
    setIsSubmitting(false);
    
    // Always show success message to prevent account enumeration
    // Even if email doesn't exist, we don't reveal that information
    if (error) {
      console.error('Password reset error:', error.message);
    }
    toast.success('If an account exists with this email, a reset link has been sent.');
    setShowForgotPassword(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {showRoleSelection && pendingUser ? (
          <RoleSelection 
            key="role-selection"
            onRoleSelect={handleRoleSelect}
            userName={pendingUser.name}
          />
        ) : (
          <motion.div
            key="auth-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
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
              <p className="text-muted-foreground">
                Clinician Portal - Diagnostic Dashboard
              </p>
            </div>

            <Card className="backdrop-blur-sm bg-card/80">
              <CardHeader>
                <CardTitle>Welcome</CardTitle>
                <CardDescription>
                  Sign in to access the diagnostic dashboard
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {showForgotPassword ? (
                    <motion.div
                      key="forgot-password"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleBackToEmailLogin}
                          className="mb-4"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back to Login
                        </Button>
                        
                        <div className="text-center space-y-2 mb-6">
                          <Mail className="w-12 h-12 mx-auto text-primary" />
                          <h3 className="text-lg font-semibold">Reset Password</h3>
                          <p className="text-sm text-muted-foreground">
                            Enter your email and we'll send you a reset link
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="forgot-email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="forgot-email"
                              type="email"
                              placeholder="clinician@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              onBlur={() => validateEmail(email)}
                              className="pl-10"
                            />
                          </div>
                          {errors.email && (
                            <p className="text-sm text-destructive">{errors.email}</p>
                          )}
                        </div>
                        
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Send Reset Link'
                          )}
                        </Button>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="email-login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <Tabs defaultValue="signin" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                          <TabsTrigger value="signin">Sign In</TabsTrigger>
                          <TabsTrigger value="signup">Sign Up</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="signin">
                          <form onSubmit={handleSignIn} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="signin-email">Email</Label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="signin-email"
                                  type="email"
                                  placeholder="clinician@example.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  onBlur={() => validateEmail(email)}
                                  className="pl-10"
                                />
                              </div>
                              {errors.email && (
                                <p className="text-sm text-destructive">{errors.email}</p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="signin-password">Password</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="signin-password"
                                  type="password"
                                  placeholder="••••••••"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  onBlur={() => validatePassword(password)}
                                  className="pl-10"
                                />
                              </div>
                              {errors.password && (
                                <p className="text-sm text-destructive">{errors.password}</p>
                              )}
                            </div>
                            
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="text-xs px-0 h-auto text-muted-foreground hover:text-primary"
                                onClick={() => setShowForgotPassword(true)}
                              >
                                Forgot Password?
                              </Button>
                            </div>
                            
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Signing in...
                                </>
                              ) : (
                                'Sign In'
                              )}
                            </Button>
                          </form>
                          
                          <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleMagicLink}
                              disabled={isSubmitting || !email}
                              title="Magic Link"
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Magic Link
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleGoogleSignIn}
                              disabled={isSubmitting}
                              title="Google"
                            >
                              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                                <path
                                  fill="currentColor"
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                  fill="currentColor"
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                  fill="currentColor"
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                  fill="currentColor"
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                              </svg>
                              Google
                            </Button>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="signup">
                          <form onSubmit={handleSignUp} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="signup-name">Full Name</Label>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="signup-name"
                                  type="text"
                                  placeholder="Dr. Jane Smith"
                                  value={fullName}
                                  onChange={(e) => setFullName(e.target.value)}
                                  className="pl-10"
                                />
                              </div>
                              {errors.fullName && (
                                <p className="text-sm text-destructive">{errors.fullName}</p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="signup-email">Email</Label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="signup-email"
                                  type="email"
                                  placeholder="clinician@example.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                  onBlur={() => validateEmail(email)}
                                  className="pl-10"
                                />
                              </div>
                              {errors.email && (
                                <p className="text-sm text-destructive">{errors.email}</p>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="signup-password">Password</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  id="signup-password"
                                  type="password"
                                  placeholder="••••••••"
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
                            
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Creating account...
                                </>
                              ) : (
                                'Create Account'
                              )}
                            </Button>
                          </form>
                          
                          <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                            </div>
                          </div>
                          
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoogleSignIn}
                            disabled={isSubmitting}
                            className="w-full"
                          >
                            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                              <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              />
                              <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              />
                              <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              />
                              <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              />
                            </svg>
                            Sign up with Google
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
            
            <p className="text-center text-sm text-muted-foreground mt-6">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
