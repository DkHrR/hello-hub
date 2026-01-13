import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Allowed origins for CORS - restrict to production domains
const ALLOWED_ORIGINS = [
  "https://lovable.dev",
  "https://www.lovable.dev",
  // Lovable preview domains
];

// Check if origin is allowed (includes Lovable preview pattern)
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Allow Lovable preview domains (*.lovable.app)
  if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin)) return true;
  
  // Allow localhost for development
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  
  return false;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

interface DiagnosticResult {
  eyeTracking: {
    chaosIndex: number;
    regressionCount: number;
    fixationIntersectionCoefficient: number;
    prolongedFixations: number;
    averageFixationDuration: number;
  };
  voice: {
    fluencyScore: number;
    prosodyScore: number;
    wordsPerMinute: number;
    pauseCount: number;
    phonemicErrors: number;
    stallCount?: number;
  };
  handwriting: {
    reversalCount: number;
    letterCrowding: number;
    graphicInconsistency: number;
    lineAdherence: number;
  };
  cognitiveLoad: {
    averagePupilDilation: number;
    overloadEvents: number;
    stressIndicators: number;
  };
  dyslexiaProbabilityIndex: number;
  adhdProbabilityIndex: number;
  dysgraphiaProbabilityIndex: number;
  overallRiskLevel: "low" | "moderate" | "high";
}

interface RequestBody {
  diagnosticResult: DiagnosticResult;
  biomarkers?: Record<string, number>;
  remoDNavMetrics?: Record<string, number>;
  studentInfo?: { name: string; grade: string; age?: number };
}

// Validate input structure
function validateInput(body: unknown): body is RequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  
  if (!b.diagnosticResult || typeof b.diagnosticResult !== "object") return false;
  
  const dr = b.diagnosticResult as Record<string, unknown>;
  if (typeof dr.dyslexiaProbabilityIndex !== "number") return false;
  if (typeof dr.adhdProbabilityIndex !== "number") return false;
  if (typeof dr.dysgraphiaProbabilityIndex !== "number") return false;
  if (!["low", "moderate", "high"].includes(dr.overallRiskLevel as string)) return false;
  
  return true;
}

// Sanitize string inputs
function sanitizeString(str: string, maxLength: number = 100): string {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLength).replace(/[<>"'&]/g, "");
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client for auth verification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    
    if (!validateInput(body)) {
      return new Response(
        JSON.stringify({ error: "Invalid request format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { diagnosticResult, biomarkers, remoDNavMetrics, studentInfo } = body;

    // Sanitize student info
    const safeName = studentInfo?.name ? sanitizeString(studentInfo.name, 50) : "Student";
    const safeGrade = studentInfo?.grade ? sanitizeString(studentInfo.grade, 10) : "Unknown";
    const safeAge = studentInfo?.age && typeof studentInfo.age === "number" && studentInfo.age > 0 && studentInfo.age < 25 
      ? studentInfo.age 
      : undefined;

    // Build prompt for AI analysis
    const prompt = buildPrompt(diagnosticResult, biomarkers, remoDNavMetrics, safeName, safeGrade, safeAge);

    // Call Lovable AI Gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      // Log configuration issue without exposing key names
      console.error("AI service configuration incomplete");
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a clinical reading specialist AI assistant helping educators analyze diagnostic assessment results for reading difficulties. Provide evidence-based, actionable recommendations. Always respond in valid JSON format matching the specified structure.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      // Log only status code, not response body which may contain sensitive details
      console.error("AI Gateway error:", aiResponse.status);
      return new Response(
        JSON.stringify({ error: "AI analysis temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse AI response - extract JSON from markdown if needed
    let insights;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      insights = JSON.parse(jsonStr.trim());
    } catch {
      // Log parsing failure without exposing AI response content
      console.error("Failed to parse AI response");
      // Return a structured fallback response
      insights = generateFallbackInsights(diagnosticResult, safeName, safeGrade);
    }

    return new Response(
      JSON.stringify({ insights }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    // Log error type without exposing sensitive details
    console.error("AI Insights error:", (error as Error)?.name || 'Unknown');
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

function buildPrompt(
  diagnosticResult: DiagnosticResult,
  biomarkers: Record<string, number> | undefined,
  remoDNavMetrics: Record<string, number> | undefined,
  studentName: string,
  grade: string,
  age: number | undefined
): string {
  const ageInfo = age ? `, Age: ${age}` : "";
  
  return `Analyze the following diagnostic assessment results for a student and provide personalized intervention recommendations.

**Student Information:**
- Name: ${studentName}
- Grade: ${grade}${ageInfo}

**Assessment Results:**
- Overall Risk Level: ${diagnosticResult.overallRiskLevel}
- Dyslexia Probability Index: ${(diagnosticResult.dyslexiaProbabilityIndex * 100).toFixed(1)}%
- ADHD Probability Index: ${(diagnosticResult.adhdProbabilityIndex * 100).toFixed(1)}%
- Dysgraphia Probability Index: ${(diagnosticResult.dysgraphiaProbabilityIndex * 100).toFixed(1)}%

**Eye Tracking Metrics:**
- Chaos Index: ${diagnosticResult.eyeTracking.chaosIndex.toFixed(2)}
- Regression Count: ${diagnosticResult.eyeTracking.regressionCount}
- Average Fixation Duration: ${diagnosticResult.eyeTracking.averageFixationDuration.toFixed(0)}ms
- Prolonged Fixations: ${diagnosticResult.eyeTracking.prolongedFixations}

**Voice/Reading Metrics:**
- Fluency Score: ${diagnosticResult.voice.fluencyScore}/100
- Prosody Score: ${diagnosticResult.voice.prosodyScore}/100
- Words Per Minute: ${diagnosticResult.voice.wordsPerMinute}
- Phonemic Errors: ${diagnosticResult.voice.phonemicErrors}
${diagnosticResult.voice.stallCount ? `- Stall Count: ${diagnosticResult.voice.stallCount}` : ""}

**Handwriting Metrics:**
- Letter Reversals: ${diagnosticResult.handwriting.reversalCount}
- Letter Crowding: ${(diagnosticResult.handwriting.letterCrowding * 100).toFixed(0)}%
- Graphic Inconsistency: ${(diagnosticResult.handwriting.graphicInconsistency * 100).toFixed(0)}%
- Line Adherence: ${(diagnosticResult.handwriting.lineAdherence * 100).toFixed(0)}%

**Cognitive Load:**
- Overload Events: ${diagnosticResult.cognitiveLoad.overloadEvents}
- Stress Indicators: ${diagnosticResult.cognitiveLoad.stressIndicators}

${biomarkers ? `**Biomarkers:** ${JSON.stringify(biomarkers)}` : ""}
${remoDNavMetrics ? `**REMoDNaV Metrics:** ${JSON.stringify(remoDNavMetrics)}` : ""}

Based on these results, provide a comprehensive analysis in the following JSON format:
\`\`\`json
{
  "summary": "2-3 sentence overview of the student's reading profile and primary areas of concern",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "interventionStrategies": [
    {
      "title": "Strategy name",
      "description": "Detailed description of the intervention",
      "priority": "high|medium|low",
      "frequency": "e.g., 3x per week",
      "duration": "e.g., 20 minutes"
    }
  ],
  "readingRecommendations": {
    "level": "Recommended reading level",
    "materials": ["Material 1", "Material 2"],
    "focusAreas": ["Area 1", "Area 2"]
  },
  "weeklyPlan": [
    { "day": "Monday", "activity": "Activity description", "duration": "20 min" }
  ],
  "progressForecast": "Expected progress with consistent intervention over 8-12 weeks",
  "clinicalNotes": "Professional notes for the educator/clinician",
  "confidence": 0.85
}
\`\`\`

Ensure all recommendations are evidence-based and appropriate for the student's grade level.`;
}

function generateFallbackInsights(
  diagnosticResult: DiagnosticResult,
  studentName: string,
  grade: string
) {
  const riskLevel = diagnosticResult.overallRiskLevel;
  const dyslexiaRisk = diagnosticResult.dyslexiaProbabilityIndex;
  
  const strategies = [];
  
  if (dyslexiaRisk > 0.5) {
    strategies.push({
      title: "Structured Literacy Program",
      description: "Implement systematic phonics instruction with multisensory techniques",
      priority: "high" as const,
      frequency: "Daily",
      duration: "30 minutes"
    });
  }
  
  if (diagnosticResult.voice.fluencyScore < 70) {
    strategies.push({
      title: "Fluency Building",
      description: "Practice repeated reading with grade-appropriate texts",
      priority: "high" as const,
      frequency: "4x per week",
      duration: "15 minutes"
    });
  }
  
  if (diagnosticResult.eyeTracking.regressionCount > 10) {
    strategies.push({
      title: "Tracking Exercises",
      description: "Use tracking guides and line markers during reading",
      priority: "medium" as const,
      frequency: "3x per week",
      duration: "10 minutes"
    });
  }

  return {
    summary: `${studentName} (Grade ${grade}) shows a ${riskLevel} risk profile. Assessment indicates areas for targeted intervention in reading fluency and comprehension.`,
    keyFindings: [
      `Overall risk level: ${riskLevel}`,
      `Dyslexia probability: ${(dyslexiaRisk * 100).toFixed(0)}%`,
      `Reading fluency score: ${diagnosticResult.voice.fluencyScore}/100`
    ],
    interventionStrategies: strategies.length > 0 ? strategies : [{
      title: "Continue Monitoring",
      description: "Maintain current reading program with periodic reassessment",
      priority: "low" as const,
      frequency: "Monthly",
      duration: "Assessment only"
    }],
    readingRecommendations: {
      level: `Grade ${grade} level with scaffolding`,
      materials: ["Decodable readers", "Leveled texts"],
      focusAreas: ["Phonemic awareness", "Fluency practice"]
    },
    weeklyPlan: [
      { day: "Monday", activity: "Phonics review", duration: "20 min" },
      { day: "Wednesday", activity: "Guided reading", duration: "25 min" },
      { day: "Friday", activity: "Fluency practice", duration: "15 min" }
    ],
    progressForecast: "With consistent intervention, improvement expected within 8-12 weeks.",
    clinicalNotes: "Recommend follow-up assessment in 6 weeks to measure progress.",
    confidence: 0.7
  };
}