import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Shield, 
  Save, 
  Loader2, 
  Calendar,
  Building2,
  Briefcase,
  Key
} from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { roles, isLoading: rolesLoading } = useUserRole();
  
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Check if user logged in via OAuth (Google)
  const isOAuthUser = user?.app_metadata?.provider === 'google' || 
                      user?.identities?.some(i => i.provider === 'google');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.full_name || '');
      setOrganization(profile.organization || '');
      setTitle(''); // Title field not in database
    }
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: displayName.trim() || null,
          organization: organization.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 12) {
      toast.error('Password must be at least 12 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'clinician': return 'default';
      case 'educator': return 'secondary';
      case 'parent': return 'outline';
      default: return 'outline';
    }
  };

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold mb-2">
              Profile <span className="text-gradient-neuro">Settings</span>
            </h1>
            <p className="text-muted-foreground">
              Manage your account information and preferences
            </p>
          </motion.div>

          <div className="space-y-6">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Account Information
                </CardTitle>
                <CardDescription>
                  Your basic account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <div className="flex gap-2 mt-1">
                      {roles.length > 0 ? (
                        roles.map(role => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">No role assigned</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-medium">
                      {user?.created_at 
                        ? new Date(user.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })
                        : 'Unknown'}
                    </p>
                  </div>
                </div>

                {isOAuthUser && (
                  <div className="p-3 rounded-lg bg-primary/10 text-sm">
                    <p className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                      </svg>
                      Signed in with Google
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Profile Details
                </CardTitle>
                <CardDescription>
                  Update your display name and professional information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="organization"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g., Lincoln Elementary School"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Password Change - Only for email/password users */}
            {!isOAuthUser && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your account password
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {showPasswordChange ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                        />
                        <p className="text-xs text-muted-foreground">
                          Minimum 12 characters
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleChangePassword} 
                          disabled={isChangingPassword}
                          className="flex-1"
                        >
                          {isChangingPassword ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Changing...
                            </>
                          ) : (
                            'Change Password'
                          )}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => setShowPasswordChange(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowPasswordChange(true)}
                      className="w-full"
                    >
                      <Key className="w-4 h-4" />
                      Change Password
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
