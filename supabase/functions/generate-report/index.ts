import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { diagnosticResultId, format = "clinical" } = await req.json();

    if (!diagnosticResultId || typeof diagnosticResultId !== "string") {
      return new Response(JSON.stringify({ error: "diagnosticResultId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the diagnostic result (RLS ensures user can only access their own)
    const { data: result, error: fetchError } = await supabase
      .from("diagnostic_results")
      .select("*")
      .eq("id", diagnosticResultId)
      .single();

    if (fetchError || !result) {
      return new Response(JSON.stringify({ error: "Diagnostic result not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch student info if available
    let studentInfo = null;
    if (result.student_id) {
      const { data: student } = await supabase
        .from("students")
        .select("name, age, grade")
        .eq("id", result.student_id)
        .single();
      studentInfo = student;
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = format === "parent"
      ? `You are a compassionate reading specialist writing a report for parents about their child's reading assessment. Use warm, encouraging language. Avoid clinical jargon. Focus on strengths first, then areas for growth. Include practical activities parents can do at home. Format as a professional but accessible report.`
      : `You are a clinical neuropsychologist writing a professional diagnostic report. Include DSM-5/ICD-11 references where applicable. Use proper clinical terminology. Include Scanpath Entropy analysis, Regression Frequency metrics, and Fixation Duration distributions. Format as a formal clinical report with sections: Executive Summary, Assessment Methods, Results, Clinical Interpretation, Recommendations, and Follow-up Plan.`;

    const prompt = `Generate a comprehensive ${format} report based on these multimodal assessment results:

**Patient/Student:** ${studentInfo ? `${studentInfo.name}, Age ${studentInfo.age}, Grade ${studentInfo.grade}` : "Self-assessment"}
**Assessment Date:** ${new Date(result.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
**Session ID:** ${result.session_id}

**EYE TRACKING METRICS:**
- Total Fixations: ${result.eye_total_fixations}
- Average Fixation Duration: ${result.eye_avg_fixation_duration}ms
- Regression Count: ${result.eye_regression_count}
- Prolonged Fixations (>400ms): ${result.eye_prolonged_fixations}
- Chaos Index (Scanpath Entropy): ${result.eye_chaos_index}
- Fixation Intersection Coefficient: ${result.eye_fixation_intersection_coefficient}

**VOICE/READING METRICS:**
- Words Per Minute: ${result.voice_words_per_minute}
- Pause Count: ${result.voice_pause_count}
- Average Pause Duration: ${result.voice_avg_pause_duration}ms
- Phonemic Errors: ${result.voice_phonemic_errors}
- Fluency Score: ${result.voice_fluency_score}/100
- Prosody Score: ${result.voice_prosody_score}/100
- Stall Count: ${result.voice_stall_count}
- Average Stall Duration: ${result.voice_avg_stall_duration}ms

**HANDWRITING METRICS:**
- Letter Reversals: ${result.handwriting_reversal_count}
- Letter Crowding: ${(Number(result.handwriting_letter_crowding) * 100).toFixed(0)}%
- Graphic Inconsistency: ${(Number(result.handwriting_graphic_inconsistency) * 100).toFixed(0)}%
- Line Adherence: ${(Number(result.handwriting_line_adherence) * 100).toFixed(0)}%

**COGNITIVE LOAD:**
- Average Pupil Dilation: ${result.cognitive_avg_pupil_dilation}
- Overload Events: ${result.cognitive_overload_events}
- Stress Indicators: ${result.cognitive_stress_indicators}

**PROBABILITY INDICES:**
- Dyslexia Probability Index: ${(Number(result.dyslexia_probability_index) * 100).toFixed(1)}%
- ADHD Probability Index: ${(Number(result.adhd_probability_index) * 100).toFixed(1)}%
- Dysgraphia Probability Index: ${(Number(result.dysgraphia_probability_index) * 100).toFixed(1)}%
- Overall Risk Level: ${result.overall_risk_level}

Generate the full report in Markdown format.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI Gateway error:", aiResponse.status);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const report = aiData.choices?.[0]?.message?.content;

    if (!report) {
      return new Response(JSON.stringify({ error: "Failed to generate report" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ report, format }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GenXAI report error:", (error as Error)?.name);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
