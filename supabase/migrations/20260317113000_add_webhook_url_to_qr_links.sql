-- Add optional webhook URL for per-link click event notifications.
ALTER TABLE public.qr_links
  ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.qr_links.webhook_url IS
  'Optional HTTP(S) endpoint that receives click.created webhook notifications for recorded link clicks.';
