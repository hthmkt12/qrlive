-- Add expires_at column to qr_links (NULL = never expires)
ALTER TABLE public.qr_links
  ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for edge function filter performance
CREATE INDEX idx_qr_links_expires_at ON public.qr_links(expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.qr_links.expires_at IS 'Optional expiration timestamp. NULL = never expires.';
