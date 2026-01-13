import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Loader2, Save } from 'lucide-react';

interface EmailPreferences {
  assessment_reports: boolean;
  weekly_summary: boolean;
  password_change: boolean;
  welcome_email: boolean;
}

interface EmailPreferencesCardProps {
  userId: string;
}

export function EmailPreferencesCard({ userId }: EmailPreferencesCardProps) {
  const [preferences, setPreferences] = useState<EmailPreferences>({
    assessment_reports: true,
    weekly_summary: true,
    password_change: true,
    welcome_email: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email_preferences')
          .eq('id', userId)
          .single();

        if (error) throw error;
        
        if (data?.email_preferences && typeof data.email_preferences === 'object') {
          const prefs = data.email_preferences as Record<string, unknown>;
          setPreferences({
            assessment_reports: prefs.assessment_reports !== false,
            weekly_summary: prefs.weekly_summary !== false,
            password_change: prefs.password_change !== false,
            welcome_email: prefs.welcome_email !== false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch email preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [userId]);

  const handleToggle = (key: keyof EmailPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const prefsJson = {
        assessment_reports: preferences.assessment_reports,
        weekly_summary: preferences.weekly_summary,
        password_change: preferences.password_change,
        welcome_email: preferences.welcome_email,
      };
      
      const { error } = await supabase
        .from('profiles')
        .update({
          email_preferences: JSON.parse(JSON.stringify(prefsJson)),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      toast.success('Email preferences saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which emails you'd like to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="assessment_reports">Assessment Reports</Label>
              <p className="text-sm text-muted-foreground">
                Receive detailed reports after each assessment
              </p>
            </div>
            <Switch
              id="assessment_reports"
              checked={preferences.assessment_reports}
              onCheckedChange={() => handleToggle('assessment_reports')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="weekly_summary">Weekly Summary</Label>
              <p className="text-sm text-muted-foreground">
                Get a weekly overview of student progress
              </p>
            </div>
            <Switch
              id="weekly_summary"
              checked={preferences.weekly_summary}
              onCheckedChange={() => handleToggle('weekly_summary')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="password_change">Security Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications when your password is changed
              </p>
            </div>
            <Switch
              id="password_change"
              checked={preferences.password_change}
              onCheckedChange={() => handleToggle('password_change')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="welcome_email">Welcome & Onboarding</Label>
              <p className="text-sm text-muted-foreground">
                Receive welcome and onboarding emails
              </p>
            </div>
            <Switch
              id="welcome_email"
              checked={preferences.welcome_email}
              onCheckedChange={() => handleToggle('welcome_email')}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Preferences
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
