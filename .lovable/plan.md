

# Plan: Fix Email Duplication, Biometric Pre-Check, Assessment Logic, and Diagnostics

## Issues Identified and Solutions

### 1. Duplicate Confirmation Emails (User Gets 2 Emails)

**Root Cause:** When a user signs up, `supabase.auth.signUp()` in `AuthContext.tsx` triggers Supabase's built-in confirmation email. Then the Auth page ALSO calls `sendVerificationEmail()` via the custom SMTP `verify-email` edge function. This results in 2 emails.

**Fix:** Disable Supabase's built-in email confirmation using the `configure-auth` tool to enable auto-confirm. The custom SMTP verification flow will handle everything -- the `verify-email` edge function already manages token generation, email sending, and marking `email_confirmed_at` via admin API. The `profiles.email_verified` flag and the custom flow remain the source of truth.

### 2. Forgot Password Uses Built-in Email Instead of SMTP

**Root Cause:** `resetPassword()` in `AuthContext.tsx` calls `supabase.auth.resetPasswordForEmail()`, which uses Supabase's built-in email system. There is no custom SMTP equivalent for password reset.

**Fix:** Create a custom password reset flow using SMTP:
- Add a `password_reset` action to the `verify-email` edge function that generates a reset token, stores it in `email_verification_tokens`, and sends a reset link via SMTP
- Add a `useSmtpPasswordReset` hook (or extend `useSmtpVerification`) with `sendPasswordResetEmail()` and `verifyResetToken()`
- Update `AuthContext.tsx` `resetPassword()` to call the custom SMTP function instead of `supabase.auth.resetPasswordForEmail()`
- Update `ResetPassword.tsx` to handle the custom token verification

### 3. Biometric Pre-Check is Overly Complex

**Root Cause:** The pre-check currently validates 4 things: luminosity, camera focus, face centered, face distance. For pupil tracking, we only need to verify that the eyes are clearly visible. The face detection uses crude variance-based heuristics that often fail.

**Fix:** Simplify `BiometricPreCheck.tsx` to only check 2 things:
- **Camera Access:** Camera is working and streaming
- **Eyes Visible:** Use MediaPipe FaceMesh to detect iris landmarks (indices 468-477). If iris landmarks are detected, eyes are visible and pupil tracking will work.

Remove the luminosity, focus, face distance, and face centered checks. Replace with a single "Eyes Detected" check using actual MediaPipe. This is more accurate and directly validates what we need.

### 4. Reading Assessment Fixation Gate Logic is Wrong

**Root Cause:** The "Continue to Voice Test" button requires `fixations.length >= 10`. Fixations are detected when gaze stays in a ~30px radius for >100ms. This is a valid metric for reading behavior, NOT about blinking. However, if MediaPipe/WebGazer isn't properly tracking gaze, fixations won't accumulate.

The real issue is likely that eye tracking initialization isn't working well for all users. The fixation requirement itself is clinically valid (ensures actual reading data was captured).

**Fix:** 
- Change the gate from requiring fixations to requiring just the time component (30 seconds of reading). The fixation count becomes informational only, not blocking.
- Keep tracking fixations for diagnostic purposes, but don't block the user from proceeding.
- Update the button text to be clearer: show a countdown timer instead of "fixations" jargon.

### 5. Diagnostic Engine -- Use Only Dyslexia Dataset for Now

**Current State:** The engine already handles this correctly. `calculateADHDIndex` and `calculateDysgraphiaIndex` use hardcoded fallback thresholds since no ADHD/dysgraphia datasets exist. Only dyslexia thresholds are data-driven (confirmed: 6 computed thresholds in `dataset_computed_thresholds`).

**Fix:** No changes needed for the diagnostic engine itself. It already falls back to hardcoded defaults for ADHD and dysgraphia. When future datasets are uploaded, they'll automatically calibrate those indices too.

---

## Files to Create

| File | Purpose |
|------|---------|
| (none -- all changes are modifications) | |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/verify-email/index.ts` | Add `reset_password` and `verify_reset` actions for SMTP-based password reset flow |
| `src/hooks/useSmtpVerification.ts` | Add `sendPasswordResetEmail()` and `verifyResetToken()` methods |
| `src/contexts/AuthContext.tsx` | Change `resetPassword()` to use custom SMTP instead of `supabase.auth.resetPasswordForEmail()` |
| `src/pages/Auth.tsx` | Update forgot password handler to use SMTP reset, handle reset token from URL |
| `src/pages/ResetPassword.tsx` | Handle custom reset token verification before allowing password change |
| `src/components/assessment/BiometricPreCheck.tsx` | Simplify to only check camera access + eyes visible via MediaPipe FaceMesh iris detection |
| `src/pages/Assessment.tsx` | Remove fixation count from the reading gate -- only require 30s of reading time |

## Configuration Changes

- Use `configure-auth` to enable auto-confirm email signups (disables built-in confirmation emails), since our custom SMTP flow handles verification independently

## Technical Details

### Password Reset via SMTP Flow

```text
User clicks "Forgot Password"
       |
       v
Frontend calls verify-email edge function with action: 'reset_password'
       |
       v
Edge function generates reset token, stores hash in email_verification_tokens
       |
       v
SMTP sends email with link: /auth?reset_token=xxx&email=yyy
       |
       v
User clicks link, Auth page detects reset_token param
       |
       v
Redirects to /reset-password with token in state
       |
       v
User enters new password, ResetPassword page calls verify-email with action: 'verify_reset'
       |
       v
Edge function validates token, uses admin API to update password
```

### Simplified Biometric Pre-Check

The new pre-check will:
1. Request camera access
2. Load MediaPipe FaceMesh (already available via CDN)
3. Process a few frames to detect iris landmarks (indices 468-477)
4. If iris landmarks found with >4 points per eye, mark "Eyes Detected" as pass
5. Enable "Start Assessment" button

This removes 3 unnecessary checks and replaces them with one that directly validates pupil tracking readiness.

### Reading Gate Simplification

Current gate: `readingElapsed >= 30 AND fixations.length >= 10`
New gate: `readingElapsed >= 30`

The fixation count will still be tracked and displayed as an info metric, but won't block the user from proceeding. This prevents users from getting stuck if eye tracking has issues while still collecting whatever gaze data is available.

