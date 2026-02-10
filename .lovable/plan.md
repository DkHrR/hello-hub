
# Fix Email System, Auth Flow, and Add Tech Beast Features

## Part 1: Critical Auth and Email Fixes

### Problem 1: Emails Not Working Properly
**Root Cause:** Since `auto_confirm_email` was enabled (to stop duplicate built-in emails), `user.email_confirmed_at` is now set immediately on signup. The entire auth flow checks `email_confirmed_at` to decide if the user is verified -- this makes the custom SMTP verification useless because the system thinks everyone is already verified.

**Fix:** Switch ALL verification checks from `user.email_confirmed_at` to `profile.email_verified` (the custom SMTP flag in the profiles table). This is the true source of truth set only when the user clicks the SMTP verification link.

**Files to modify:**
- `src/components/auth/ProtectedRoute.tsx` -- Check `profile.email_verified` instead of `user.email_confirmed_at`
- `src/pages/Auth.tsx` (line 127) -- Check `profile?.email_verified` instead of `user.email_confirmed_at`

### Problem 2: Back Button Shows Role Selection Flash
**Root Cause:** When the user clicks "Back to Sign In" from the verification screen, it sets `showEmailConfirmation = false`. Since auto-confirm sets `email_confirmed_at` immediately, the useEffect sees a confirmed user with no role and shows role selection.

**Fix:**
- The "Back to Sign In" button should sign the user OUT and reset the form to the login/signup screen
- Add a guard: only show role selection if `profile?.email_verified === true`
- Ensure the AnimatePresence transition order is: email confirmation check BEFORE role selection check

### Problem 3: Password Reset Link Not Being Received
**Root Cause:** The edge function works (tested and confirmed with 200 response). The issue is the `handleForgotPassword` in `Auth.tsx` calls `resetPassword(email)` which calls `supabase.functions.invoke('verify-email', ...)`. Since the user is NOT logged in during forgot password, the Supabase client sends no auth token. The verify-email function has `verify_jwt = false` so it accepts unauthenticated calls -- this should work. However, the `origin` header may not be set correctly when the edge function constructs the reset link.

**Fix:** Ensure the password reset flow correctly constructs the link using the published/preview URL. Also add console logging to debug if the SMTP send is actually being called. The ResetPassword page already handles `reset_token` and `email` URL params correctly.

---

## Part 2: Auth Flow Changes (Detailed)

### ProtectedRoute.tsx
```
Before: checks user.email_confirmed_at
After:  checks profile.email_verified (from AuthContext)
```
- Import and use `profile` from `useAuth()`
- OAuth users (Google) bypass as before
- Email/password users must have `profile?.email_verified === true`

### Auth.tsx useEffect (line 124-150)
```
Before: const isEmailConfirmed = user.email_confirmed_at || provider === 'google'
After:  const isEmailConfirmed = profile?.email_verified || provider === 'google'
```
- Only proceed to role selection if custom SMTP verification is complete
- Back button signs out the user to prevent the role selection flash

### Auth.tsx Back Button (line 356-366)
```
Before: Just hides the email confirmation screen
After:  Signs out user + hides email confirmation screen
```
This prevents the useEffect from seeing an active user session and flashing role selection.

---

## Part 3: Tech Beast Features for 2027 Market Mind Forum

### Feature 1: CRAAP Test Data Reliability Score
Add a data quality scoring system based on the CRAAP framework (Currency, Relevance, Authority, Accuracy, Purpose) for each dataset uploaded. This evaluates how trustworthy the diagnostic baselines are.

**Implementation:**
- Add a `data_quality_score` JSONB column to `dataset_reference_profiles` with CRAAP sub-scores
- Create a `DataQualityBadge` component showing the reliability grade (A-F) on the dashboard
- The `process-dataset` edge function will auto-calculate: Currency (publication date recency), Accuracy (statistical significance of sample size), Authority (source metadata)

### Feature 2: TAM/SAM/SOM Market Visualization
Build an admin-only analytics panel showing market penetration data with interactive charts.

**Implementation:**
- Create `src/pages/AdminAnalytics.tsx` with role-gated access (clinician only)
- Use Recharts (already installed) for concentric donut charts showing TAM ($4.2B global dyslexia market), SAM (India K-12 segment), SOM (current user base)
- Pull real user counts from the database to show actual SOM numbers

### Feature 3: Competitor Matrix Dashboard
A real-time comparison dashboard showing Neuro-Read X's diagnostic accuracy vs industry benchmarks.

**Implementation:**
- Create `src/components/dashboard/CompetitorMatrix.tsx`
- Store competitor benchmark data in a `competitor_benchmarks` table
- Radar chart comparing: Sensitivity, Specificity, AUC-ROC, Multi-modal coverage, Processing speed
- Highlight Neuro-Read X's USP: "Assertive but Justifiable" -- clinical benchmarking backed by ETDD70 dataset

### Feature 4: Teacher Feedback Loop (Primary Research)
Integrate structured feedback collection from teachers/clinicians directly into the UI after each assessment.

**Implementation:**
- Create `teacher_feedback` table with structured fields (agreement with diagnosis, observed behaviors, severity rating)
- Add a `TeacherFeedbackForm` component shown after viewing assessment results
- Aggregate feedback to create a "Clinical Consensus Score" that strengthens diagnostic confidence
- Feed this back into the normative engine as a calibration signal

### Feature 5: Research Dashboard with Dataset CRAAP Scoring
A dedicated admin view showing all uploaded datasets, their CRAAP scores, sample sizes, and impact on diagnostic thresholds.

**Implementation:**
- Create `src/pages/ResearchDashboard.tsx`
- Visualize how each dataset shifts the diagnostic thresholds (before/after comparison)
- Show Cohen's d effect sizes and statistical power for each metric

---

## Implementation Priority

| Priority | Task | Files |
|----------|------|-------|
| 1 (Critical) | Fix ProtectedRoute to use profile.email_verified | `src/components/auth/ProtectedRoute.tsx` |
| 2 (Critical) | Fix Auth.tsx verification check + back button | `src/pages/Auth.tsx` |
| 3 (Critical) | Verify password reset SMTP delivery works end-to-end | `supabase/functions/verify-email/index.ts` (minor logging) |
| 4 (Feature) | CRAAP Test scoring system | New component + DB migration |
| 5 (Feature) | TAM/SAM/SOM market panel | New page + Recharts |
| 6 (Feature) | Competitor Matrix | New component + DB table |
| 7 (Feature) | Teacher Feedback Loop | New component + DB table |
| 8 (Feature) | Research Dashboard | New page |

Items 1-3 will be implemented immediately. Items 4-8 are the "Tech Beast" upgrades and will follow.
