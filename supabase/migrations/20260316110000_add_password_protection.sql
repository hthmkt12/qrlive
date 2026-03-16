-- Add password protection columns to qr_links
-- NULL = no password required (backward compatible)

ALTER TABLE public.qr_links
  ADD COLUMN password_hash TEXT DEFAULT NULL,
  ADD COLUMN password_salt TEXT DEFAULT NULL;

COMMENT ON COLUMN public.qr_links.password_hash IS 'SHA-256 hash of salt+password. NULL = no password required.';
COMMENT ON COLUMN public.qr_links.password_salt IS 'Random salt (UUID) for password hashing.';
