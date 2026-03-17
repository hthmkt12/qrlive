-- Add webhook HMAC secret support: nullable `webhook_secret` column + computed `has_webhook_secret`
ALTER TABLE qr_links ADD COLUMN webhook_secret TEXT;
ALTER TABLE qr_links ADD COLUMN has_webhook_secret BOOLEAN GENERATED ALWAYS AS (webhook_secret IS NOT NULL) STORED;
