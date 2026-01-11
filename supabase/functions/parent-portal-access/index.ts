import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

// Allowed origins for CORS - restrict to production domains
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://www.lovable.dev',
];

// Check if the origin is allowed (production domains, Lovable preview, or localhost for dev)
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Lovable preview domains (*.lovable.app)
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)) return true;
  // Allow localhost for development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

// Get CORS headers based on request origin
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Validate access code format (8 uppercase alphanumeric chars, no confusing chars)
function isValidAccessCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
  return validChars.test(code);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client identifier for rate limiting (use IP or fallback)
    const clientId = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'anonymous';
    
    // Check rate limiting
    if (isRateLimited(clientId)) {
      console.log(`Rate limit exceeded for client: ${clientId}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessCode, action } = await req.json();

    // Validate access code format before any database operations
    if (!isValidAccessCodeFormat(accessCode)) {
      console.log(`Invalid access code format attempted: ${clientId}`);
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid access code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'validate') {
      // Check if access code exists, is valid, and not expired
      const { data: linkData, error: linkError } = await supabase
        .from('parent_student_links')
        .select('id, student_id, access_code, parent_id, linked_at, expires_at')
        .eq('access_code', accessCode)
        .maybeSingle();

      if (linkError) {
        console.error('Database error during validation:', linkError.message);
        return new Response(
          JSON.stringify({ valid: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!linkData) {
        // Log failed attempt without revealing code
        console.log(`Access code validation failed for client: ${clientId}`);
        return new Response(
          JSON.stringify({ valid: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if access code has expired
      const expiresAt = new Date(linkData.expires_at);
      if (expiresAt < new Date()) {
        console.log(`Expired access code attempted by client: ${clientId}`);
        return new Response(
          JSON.stringify({ valid: false, error: 'Access code has expired' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already claimed
      if (linkData.parent_id) {
        return new Response(
          JSON.stringify({ 
            valid: true, 
            studentId: linkData.student_id,
            claimed: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Valid unclaimed code
      console.log(`Access code validated successfully for student: ${linkData.student_id}`);
      return new Response(
        JSON.stringify({ 
          valid: true, 
          studentId: linkData.student_id,
          claimed: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'getData') {
      // Fetch student and assessment data for parent portal
      const { data: linkData, error: linkError } = await supabase
        .from('parent_student_links')
        .select('id, student_id, parent_id, expires_at')
        .eq('access_code', accessCode)
        .maybeSingle();

      if (linkError || !linkData) {
        return new Response(
          JSON.stringify({ error: 'Invalid access code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if access code has expired
      const expiresAt = new Date(linkData.expires_at);
      if (expiresAt < new Date()) {
        console.log(`Expired access code used for getData by client`);
        return new Response(
          JSON.stringify({ error: 'Access code has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch student data
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, age, grade, risk_level, created_at')
        .eq('id', linkData.student_id)
        .single();

      if (studentError || !studentData) {
        return new Response(
          JSON.stringify({ error: 'Student not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch diagnostic results (limited data for parent view)
      const { data: resultsData, error: resultsError } = await supabase
        .from('diagnostic_results')
        .select(`
          id,
          created_at,
          overall_risk_level,
          dyslexia_probability_index,
          adhd_probability_index,
          dysgraphia_probability_index,
          voice_fluency_score,
          voice_prosody_score
        `)
        .eq('student_id', linkData.student_id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Log successful data access
      console.log(`Parent portal data accessed for student: ${linkData.student_id}`);

      return new Response(
        JSON.stringify({
          student: {
            id: studentData.id,
            name: studentData.name,
            age: studentData.age,
            grade: studentData.grade,
            riskLevel: studentData.risk_level,
          },
          assessments: resultsData || [],
          // Never expose access codes in responses
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parent portal access error:', error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
