-- Add nullable JSONB column for persisting QR code visual configuration per link.
-- null means the frontend will use its default styling.
ALTER TABLE qr_links ADD COLUMN IF NOT EXISTS qr_config JSONB DEFAULT NULL;
