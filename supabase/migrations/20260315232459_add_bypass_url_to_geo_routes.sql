-- Phase 09: Add bypass_url to geo_routes for geo-unblock routing
-- When set, the redirect edge function prefers bypass_url over target_url for that country.

ALTER TABLE public.geo_routes ADD COLUMN bypass_url TEXT;
