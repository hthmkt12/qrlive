
-- Create table for QR links
CREATE TABLE public.qr_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  default_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for geo routes
CREATE TABLE public.geo_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.qr_links(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  country_code TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for click events
CREATE TABLE public.click_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.qr_links(id) ON DELETE CASCADE,
  country TEXT,
  country_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qr_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

-- Public read/write for qr_links (no auth required for this app)
CREATE POLICY "Anyone can read qr_links" ON public.qr_links FOR SELECT USING (true);
CREATE POLICY "Anyone can insert qr_links" ON public.qr_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update qr_links" ON public.qr_links FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete qr_links" ON public.qr_links FOR DELETE USING (true);

CREATE POLICY "Anyone can read geo_routes" ON public.geo_routes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert geo_routes" ON public.geo_routes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update geo_routes" ON public.geo_routes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete geo_routes" ON public.geo_routes FOR DELETE USING (true);

CREATE POLICY "Anyone can read click_events" ON public.click_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert click_events" ON public.click_events FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_qr_links_short_code ON public.qr_links(short_code);
CREATE INDEX idx_click_events_link_id ON public.click_events(link_id);
CREATE INDEX idx_click_events_created_at ON public.click_events(created_at);
CREATE INDEX idx_geo_routes_link_id ON public.geo_routes(link_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_qr_links_updated_at
  BEFORE UPDATE ON public.qr_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
