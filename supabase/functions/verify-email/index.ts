import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// CORS configuration
const ALLOWED_ORIGINS = [
  "https://lovable.dev",
  "https://www.lovable.dev",
  "https://lovable.app",
  "https://www.lovable.app",
];

function isLovablePreviewOrigin(origin: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
         /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:")) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }
  
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isLovablePreviewOrigin(origin))) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }
  
  return {
    "Access-Control-Allow-Origin": "https://lovable.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Generate secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash token for storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

// Sanitize text for HTML
function sanitize(text: string): string {
  return text.replace(/[<>&"']/g, (c) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return entities[c] || c;
  });
}

// Send email via SMTP
async function sendSmtpEmail(to: string, subject: string, html: string): Promise<void> {
  const smtpUser = Deno.env.get("GMAIL_SENDER_EMAIL");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  
  if (!smtpUser || !smtpPassword) {
    throw new Error("SMTP configuration missing");
  }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: smtpUser,
        password: smtpPassword,
      },
    },
  });

  try {
    await client.send({
      from: `Neuro-Read X <${smtpUser}>`,
      to: to,
      subject: subject,
      html: html,
    });
  } finally {
    await client.close();
  }
}

// Verification email template
function getVerificationEmailTemplate(userName: string, verificationLink: string): string {
  const safeName = sanitize(userName);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 40px; text-align: center; }
        .content { padding: 30px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .warning { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin-top: 20px; color: #854d0e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🔐 Verify Your Email</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Neuro-Read X Clinical Platform</p>
        </div>
        <div class="content">
          <h2 style="color: #333;">Hello ${safeName}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for signing up for Neuro-Read X. To complete your registration and ensure the security of your clinical account, please verify your email address.
          </p>
          <div style="text-align: center;">
            <a href="${verificationLink}" class="cta-button" style="color: white !important;">
              ✓ Verify Email Address
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; color: #6366f1; font-size: 14px;">
            ${verificationLink}
          </p>
          <div class="warning">
            <p style="margin: 0;">
              <strong>⚠️ This link expires in 24 hours.</strong><br>
              If you didn't create an account, please ignore this email.
            </p>
          </div>
        </div>
        <div class="footer">
          <p>Neuro-Read X - AI-Powered Learning Assessment Platform</p>
          <p>© ${new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Password reset email template
function getPasswordResetEmailTemplate(userName: string, resetLink: string): string {
  const safeName = sanitize(userName);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ef4444, #f97316); color: white; padding: 40px; text-align: center; }
        .content { padding: 30px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #ef4444, #f97316); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .warning { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin-top: 20px; color: #854d0e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🔑 Reset Your Password</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Neuro-Read X Clinical Platform</p>
        </div>
        <div class="content">
          <h2 style="color: #333;">Hello ${safeName}!</h2>
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password.
          </p>
          <div style="text-align: center;">
            <a href="${resetLink}" class="cta-button" style="color: white !important;">
              🔑 Reset Password
            </a>
          </div>
          <p style="color: #666; line-height: 1.6; font-size: 14px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; color: #ef4444; font-size: 14px;">
            ${resetLink}
          </p>
          <div class="warning">
            <p style="margin: 0;">
              <strong>⚠️ This link expires in 1 hour.</strong><br>
              If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
          </div>
        </div>
        <div class="footer">
          <p>Neuro-Read X - AI-Powered Learning Assessment Platform</p>
          <p>© ${new Date().getFullYear()} All rights reserved</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

interface RequestBody {
  action: 'send' | 'verify' | 'resend' | 'reset_password' | 'verify_reset';
  email?: string;
  token?: string;
  userName?: string;
  newPassword?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const ipAddress = req.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const body: RequestBody = await req.json();
    const { action, email, token, userName, newPassword } = body;

    // === SEND / RESEND VERIFICATION EMAIL ===
    if (action === 'send' || action === 'resend') {
      if (!email || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ error: 'Valid email is required' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const user = users.find(u => u.email === email);
      if (!user) {
        return new Response(
          JSON.stringify({ success: true, message: 'If the email exists, a verification link has been sent.' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check profile.email_verified (custom SMTP flag) instead of email_confirmed_at
      // because auto_confirm_email is enabled, email_confirmed_at is always set
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('email_verified')
        .eq('user_id', user.id)
        .single();
      
      if (profileData?.email_verified === true) {
        return new Response(
          JSON.stringify({ success: true, message: 'Email is already verified.' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await supabaseAdmin
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('used_at', null);

      const rawToken = generateToken();
      const tokenHash = await hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { error: insertError } = await supabaseAdmin
        .from('email_verification_tokens')
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) throw insertError;

      const baseUrl = origin || 'https://lovable.app';
      const verificationUrl = `${baseUrl}/auth?verify=${rawToken}&email=${encodeURIComponent(email)}`;

      const displayName = userName || user.user_metadata?.display_name || email.split('@')[0];
      await sendSmtpEmail(
        email,
        '🔐 Verify Your Email - Neuro-Read X',
        getVerificationEmailTemplate(displayName, verificationUrl)
      );

      await supabaseAdmin
        .from('verification_audit_log')
        .insert({
          user_id: user.id,
          action: action === 'resend' ? 'email_resend' : 'email_sent',
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { email_masked: email.replace(/^(.{2}).*@/, '$1***@') }
        });

      console.log('Verification email sent via SMTP to:', email.replace(/^(.{2}).*@/, '$1***@'));

      return new Response(
        JSON.stringify({ success: true, message: 'Verification email sent.' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // === VERIFY EMAIL TOKEN ===
    if (action === 'verify') {
      if (!token || !email || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ error: 'Token and email are required' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const user = users.find(u => u.email === email);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired verification link.' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const tokenHash = await hashToken(token);

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('email_verification_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        await supabaseAdmin
          .from('verification_audit_log')
          .insert({
            user_id: user.id,
            action: 'token_expired',
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: { reason: 'Token not found or expired' }
          });

        return new Response(
          JSON.stringify({ error: 'Invalid or expired verification link.' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      await supabaseAdmin
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );

      if (updateError) throw updateError;

      await supabaseAdmin
        .from('profiles')
        .update({ email_verified: true })
        .eq('user_id', user.id);

      await supabaseAdmin
        .from('verification_audit_log')
        .insert({
          user_id: user.id,
          action: 'email_verified',
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { verified_at: new Date().toISOString() }
        });

      console.log('Email verified successfully for user:', user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Email verified successfully!' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // === SEND PASSWORD RESET EMAIL VIA SMTP ===
    if (action === 'reset_password') {
      if (!email || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ success: true, message: 'If an account exists, a reset link has been sent.' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const user = users.find(u => u.email === email);
      if (!user) {
        // Don't reveal if email exists
        return new Response(
          JSON.stringify({ success: true, message: 'If an account exists, a reset link has been sent.' }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Invalidate existing reset tokens for this user
      await supabaseAdmin
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('used_at', null);

      const rawToken = generateToken();
      const tokenHash = await hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const { error: insertError } = await supabaseAdmin
        .from('email_verification_tokens')
        .insert({
          user_id: user.id,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) throw insertError;

      const baseUrl = origin || 'https://lovable.app';
      const resetUrl = `${baseUrl}/reset-password?reset_token=${rawToken}&email=${encodeURIComponent(email)}`;

      const displayName = user.user_metadata?.display_name || user.user_metadata?.name || email.split('@')[0];
      await sendSmtpEmail(
        email,
        '🔑 Reset Your Password - Neuro-Read X',
        getPasswordResetEmailTemplate(displayName, resetUrl)
      );

      await supabaseAdmin
        .from('verification_audit_log')
        .insert({
          user_id: user.id,
          action: 'password_reset_sent',
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { email_masked: email.replace(/^(.{2}).*@/, '$1***@') }
        });

      console.log('Password reset email sent via SMTP to:', email.replace(/^(.{2}).*@/, '$1***@'));

      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists, a reset link has been sent.' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // === VERIFY RESET TOKEN AND UPDATE PASSWORD ===
    if (action === 'verify_reset') {
      if (!token || !email || !isValidEmail(email) || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'Token, email, and new password are required' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const user = users.find(u => u.email === email);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired reset link.' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const tokenHash = await hashToken(token);

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('email_verification_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        await supabaseAdmin
          .from('verification_audit_log')
          .insert({
            user_id: user.id,
            action: 'reset_token_expired',
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: { reason: 'Reset token not found or expired' }
          });

        return new Response(
          JSON.stringify({ error: 'Invalid or expired reset link.' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark token as used
      await supabaseAdmin
        .from('email_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      // Update password via admin API
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) throw updateError;

      await supabaseAdmin
        .from('verification_audit_log')
        .insert({
          user_id: user.id,
          action: 'password_reset_complete',
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { reset_at: new Date().toISOString() }
        });

      console.log('Password reset successfully for user:', user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully!' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Verification error:', error?.name || 'Unknown', error?.message);
    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
