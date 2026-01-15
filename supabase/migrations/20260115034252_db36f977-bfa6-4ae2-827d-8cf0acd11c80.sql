-- SMTP-based custom email verification tokens (client cannot access)
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure at most one active token per user
CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_active_user_idx
ON public.email_verification_tokens (user_id)
WHERE used_at IS NULL;

-- Fast lookup
CREATE INDEX IF NOT EXISTS email_verification_tokens_token_hash_idx
ON public.email_verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_at_idx
ON public.email_verification_tokens (expires_at);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Intentionally no RLS policies: frontend must NOT read/insert/update/delete these tokens.
