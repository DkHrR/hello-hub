
# Plan: Fix Email Verification Flow and Authentication Issues

## Issues Identified

Based on my investigation, I've identified the following problems:

### Issue 1: Signup Error Despite Correct Information
**Root Cause:** The console logs reveal the actual error is `AuthWeakPasswordError` with reason `"pwned"` - meaning the password was found in a data breach database. The UI shows a generic "Unable to create account" message instead of the specific password issue.

**Fix:** Show the specific weak password error message to users so they know to choose a different password.

---

### Issue 2: SMTP Service is Gmail, Not Resend
**Status:** Already correctly using Gmail SMTP via `denomailer` library. Both `send-email` and `verify-email` edge functions use Gmail SMTP (smtp.gmail.com:465). No changes needed here.

---

### Issue 3: Users Not Getting Confirmation Email with Link
**Root Cause:** The `verify-email` edge function exists and has the correct email template with a clickable link, BUT:
1. No logs appear for the edge function, suggesting it may not be getting called
2. The function requires the user to exist in Supabase Auth before it can send an email, but with `auto_confirm_email: true`, users might be created without needing verification

**Problem:** Supabase is configured with `auto_confirm_email: true`, which means:
- Supabase automatically confirms the email address
- The user's `email_confirmed_at` is set immediately
- Our custom SMTP verification flow is bypassed

---

### Issue 4: Welcome Email Sent Instead of Confirmation Email
**Root Cause:** In `Auth.tsx` lines 133-146, a welcome email is sent when `isEmailConfirmed` is true. Since `auto_confirm_email: true` is enabled, the email is immediately confirmed upon signup, triggering the welcome email logic instead of the confirmation flow.

---

### Issue 5: Back Button Allows Dashboard Access Without Email Verification
**Root Cause:** The `ProtectedRoute` component only checks if `user` exists, not if the email is verified. When a user clicks "Back to Sign In" on the email confirmation screen, they can navigate to protected routes because they have a valid session.

---

## Solution Plan

### Step 1: Disable Auto-Confirm Email
Configure Supabase auth to disable auto email confirmation:
- Set `auto_confirm_email: false`
- This ensures users must verify their email before being fully authenticated

### Step 2: Improve Error Messages for Password Validation
Update `Auth.tsx` to show specific password errors:
- Check for `AuthWeakPasswordError` code
- Display "Password is too common or found in a breach. Please choose a stronger password"
- This helps users understand why signup is failing

### Step 3: Fix ProtectedRoute to Require Email Verification
Update `ProtectedRoute` to check `email_confirmed_at`:
- If user exists but email is not confirmed, redirect to `/auth` 
- This prevents the back-button bypass vulnerability

### Step 4: Fix the Email Flow Logic
Update `Auth.tsx` to properly sequence emails:
1. On signup: Send CONFIRMATION email via `verify-email` function
2. After email verified + role selected: Send WELCOME email
3. Remove the automatic welcome email on `email_confirmed_at` change

### Step 5: Handle the Verification Link URL Construction
Ensure the verification URL is correctly constructed:
- Use the project's actual URL, not just `origin`
- Include proper encoding for email parameter

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Fix error message handling for weak passwords, fix welcome/confirmation email logic sequence |
| `src/components/auth/ProtectedRoute.tsx` | Add email verification check to prevent back-button bypass |
| `supabase/functions/verify-email/index.ts` | Verify URL construction is correct, add more detailed logging |
| Configure Auth | Disable `auto_confirm_email` |

---

## Technical Details

### ProtectedRoute Enhancement
```text
1. Check if user.email_confirmed_at exists
2. If not confirmed AND provider is email (not OAuth):
   - Redirect to /auth with state indicating unverified email
3. Let verified users and OAuth users through
```

### Auth.tsx Email Flow
```text
Signup Flow:
1. User fills form -> signUp() called
2. If success -> sendVerificationEmail() via SMTP
3. Show "Check Your Email" screen
4. Disable navigation until verified

Post-Verification:
1. User clicks link -> verifyToken() called
2. If success -> show role selection
3. After role selection -> sendWelcomeEmail()
4. Navigate to dashboard
```

### Password Error Handling
```text
if (error.code === 'weak_password') {
  if (error.reasons?.includes('pwned')) {
    toast.error('This password was found in a data breach. Please choose a different one.');
  } else {
    toast.error('Password is too weak. Please choose a stronger password.');
  }
}
```

---

## Expected Outcome After Fix

1. Users see specific error messages when passwords are weak/breached
2. Gmail SMTP sends verification emails with clickable links
3. Users cannot access protected routes until email is verified
4. Confirmation email is sent on signup, welcome email after verification + role selection
5. Back button cannot bypass email verification requirement
