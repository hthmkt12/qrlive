-- Add a stored generated column that exposes password presence without leaking the hash
-- This enables the dashboard query to select has_password directly, never touching password_hash

ALTER TABLE public.qr_links
  ADD COLUMN has_password BOOLEAN GENERATED ALWAYS AS (password_hash IS NOT NULL) STORED;

COMMENT ON COLUMN public.qr_links.has_password IS 'Server-computed boolean: true when a password is set. Used by the dashboard; avoids exposing password_hash to frontend.';
