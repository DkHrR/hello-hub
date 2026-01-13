import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// CORS configuration - restrict to allowed origins
const ALLOWED_ORIGINS = [
  "https://lovable.dev",
  "https://www.lovable.dev",
  "https://lovable.app",
  "https://www.lovable.app",
];

// Check if origin is a Lovable preview URL pattern
function isLovablePreviewOrigin(origin: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
         /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow localhost in development
  if (origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:")) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }
  
  // Allow known origins or Lovable preview URLs
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isLovablePreviewOrigin(origin))) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }
  
  // Default to most restrictive
  return {
    "Access-Control-Allow-Origin": "https://lovable.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type?: 'assessment_report' | 'welcome' | 'weekly_summary';
  assessmentId?: string;
  studentName?: string;
}

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // max emails per window
const RATE_WINDOW_MS = 60000; // 1 minute window

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return false;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return true;
  }
  
  userLimit.count++;
  return false;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

// Create JWT for Google API authentication
async function createGoogleJWT(serviceAccountKey: string): Promise<string> {
  const keyData = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  
  const payload = {
    iss: keyData.client_email,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
    sub: Deno.env.get("GMAIL_SENDER_EMAIL"),
  };
  
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${headerB64}.${payloadB64}`;
  
  // Import the private key
  const pemContents = keyData.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

// Get access token from Google
async function getGoogleAccessToken(serviceAccountKey: string): Promise<string> {
  const jwt = await createGoogleJWT(serviceAccountKey);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// Send email via Gmail API
async function sendGmailEmail(
  accessToken: string,
  senderEmail: string,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const emailContent = [
    `From: Neuro-Read X <${senderEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");
  
  const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

// Email templates
function getAssessmentReportTemplate(studentName: string, data: any): string {
  // Sanitize student name to prevent XSS
  const safeName = studentName.replace(/[<>&"']/g, (c) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return entities[c] || c;
  });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .metric { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #eee; }
        .metric-label { color: #666; }
        .metric-value { font-weight: bold; color: #333; }
        .risk-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
        .risk-low { background: #dcfce7; color: #166534; }
        .risk-moderate { background: #fef9c3; color: #854d0e; }
        .risk-high { background: #fecaca; color: #dc2626; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧠 Neuro-Read X Assessment Report</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">Screening results for ${safeName}</p>
        </div>
        <div class="content">
          <h2 style="color: #333; margin-top: 0;">Assessment Summary</h2>
          
          <div class="metric">
            <span class="metric-label">Overall Risk Level</span>
            <span class="risk-badge risk-${(data.overall_risk_level || 'low').toLowerCase()}">${data.overall_risk_level || 'Low'}</span>
          </div>
          
          <h3 style="color: #6366f1; margin-top: 25px;">Probability Indices</h3>
          <div class="metric">
            <span class="metric-label">Dyslexia Probability</span>
            <span class="metric-value">${((data.dyslexia_probability_index || 0) * 100).toFixed(1)}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Dysgraphia Probability</span>
            <span class="metric-value">${((data.dysgraphia_probability_index || 0) * 100).toFixed(1)}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">ADHD Probability</span>
            <span class="metric-value">${((data.adhd_probability_index || 0) * 100).toFixed(1)}%</span>
          </div>
          
          <h3 style="color: #6366f1; margin-top: 25px;">Reading Metrics</h3>
          <div class="metric">
            <span class="metric-label">Words Per Minute</span>
            <span class="metric-value">${data.voice_words_per_minute || 'N/A'}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Fluency Score</span>
            <span class="metric-value">${data.voice_fluency_score || 'N/A'}/100</span>
          </div>
          <div class="metric">
            <span class="metric-label">Eye Regressions</span>
            <span class="metric-value">${data.eye_regression_count || 'N/A'}</span>
          </div>
          
          <p style="margin-top: 25px; padding: 15px; background: #f0f9ff; border-radius: 8px; color: #0369a1;">
            <strong>Note:</strong> This screening is not a diagnosis. Please consult with a qualified professional for a comprehensive evaluation.
          </p>
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

function getWelcomeTemplate(userName: string): string {
  // Sanitize user name to prevent XSS
  const safeName = userName.replace(/[<>&"']/g, (c) => {
    const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return entities[c] || c;
  });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 40px; text-align: center; }
        .content { padding: 30px; }
        .cta-button { display: inline-block; background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to Neuro-Read X!</h1>
        </div>
        <div class="content">
          <h2 style="color: #333;">Hello ${safeName}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Welcome to Neuro-Read X, your AI-powered platform for learning difference screening and assessment.
          </p>
          <p style="color: #666; line-height: 1.6;">
            Get started by:
          </p>
          <ul style="color: #666; line-height: 1.8;">
            <li>Adding your first student profile</li>
            <li>Running an eye-tracking assessment</li>
            <li>Reviewing detailed diagnostic reports</li>
          </ul>
          <p style="color: #666; line-height: 1.6;">
            Our advanced AI analyzes reading patterns, eye movements, and handwriting to help identify potential learning differences early.
          </p>
        </div>
        <div class="footer">
          <p>Neuro-Read X - AI-Powered Learning Assessment Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create authenticated Supabase client
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user's token
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2. Check rate limiting
    if (isRateLimited(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please wait before sending more emails.' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const senderEmail = Deno.env.get("GMAIL_SENDER_EMAIL");
    
    if (!serviceAccountKey || !senderEmail) {
      throw new Error("Email configuration missing. Please set GOOGLE_SERVICE_ACCOUNT_KEY and GMAIL_SENDER_EMAIL secrets.");
    }

    const { to, subject, html, type, assessmentId, studentName }: EmailRequest = await req.json();

    // 3. Validate recipient email
    if (!to || !isValidEmail(to)) {
      return new Response(
        JSON.stringify({ error: 'Valid recipient email is required' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let emailHtml = html;
    let emailSubject = subject;

    // Handle specific email types with authorization checks
    if (type === 'assessment_report' && assessmentId) {
      // 4. Verify the user owns this assessment (use authenticated client - RLS enforced)
      const { data: assessment, error } = await supabaseAuth
        .from("diagnostic_results")
        .select("*")
        .eq("id", assessmentId)
        .single();

      if (error || !assessment) {
        return new Response(
          JSON.stringify({ error: 'Assessment not found or you do not have permission to access it' }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      emailHtml = getAssessmentReportTemplate(studentName || "Student", assessment);
      emailSubject = `Assessment Report for ${studentName || "Student"} - Neuro-Read X`;
    } else if (type === 'welcome') {
      emailHtml = getWelcomeTemplate(studentName || "User");
      emailSubject = "Welcome to Neuro-Read X! 🧠";
    } else if (!emailHtml) {
      // For custom emails, require HTML content
      return new Response(
        JSON.stringify({ error: 'Email content is required for custom emails' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get access token and send email
    const accessToken = await getGoogleAccessToken(serviceAccountKey);
    await sendGmailEmail(accessToken, senderEmail, to, emailSubject || "Neuro-Read X Notification", emailHtml);

    console.log(`Email sent successfully to ${to} by user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send email. Please try again later." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
