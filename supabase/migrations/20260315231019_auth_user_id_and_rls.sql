-- Phase 02: Add user ownership and tighten RLS policies

-- Add user_id to qr_links (nullable to avoid breaking existing rows)
ALTER TABLE public.qr_links
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ───────────────────────────────────────────────
-- Drop old permissive policies
-- ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read qr_links"   ON public.qr_links;
DROP POLICY IF EXISTS "Anyone can insert qr_links" ON public.qr_links;
DROP POLICY IF EXISTS "Anyone can update qr_links" ON public.qr_links;
DROP POLICY IF EXISTS "Anyone can delete qr_links" ON public.qr_links;

DROP POLICY IF EXISTS "Anyone can read geo_routes"   ON public.geo_routes;
DROP POLICY IF EXISTS "Anyone can insert geo_routes" ON public.geo_routes;
DROP POLICY IF EXISTS "Anyone can update geo_routes" ON public.geo_routes;
DROP POLICY IF EXISTS "Anyone can delete geo_routes" ON public.geo_routes;

DROP POLICY IF EXISTS "Anyone can read click_events"   ON public.click_events;
DROP POLICY IF EXISTS "Anyone can insert click_events" ON public.click_events;

-- ───────────────────────────────────────────────
-- qr_links: owner-only access
-- ───────────────────────────────────────────────
CREATE POLICY "qr_links_select_owner" ON public.qr_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "qr_links_insert_owner" ON public.qr_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qr_links_update_owner" ON public.qr_links
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "qr_links_delete_owner" ON public.qr_links
  FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────
-- geo_routes: inherit ownership via qr_links
-- ───────────────────────────────────────────────
CREATE POLICY "geo_routes_select_owner" ON public.geo_routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.qr_links
      WHERE qr_links.id = geo_routes.link_id
        AND qr_links.user_id = auth.uid()
    )
  );

CREATE POLICY "geo_routes_insert_owner" ON public.geo_routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.qr_links
      WHERE qr_links.id = geo_routes.link_id
        AND qr_links.user_id = auth.uid()
    )
  );

CREATE POLICY "geo_routes_update_owner" ON public.geo_routes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.qr_links
      WHERE qr_links.id = geo_routes.link_id
        AND qr_links.user_id = auth.uid()
    )
  );

CREATE POLICY "geo_routes_delete_owner" ON public.geo_routes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.qr_links
      WHERE qr_links.id = geo_routes.link_id
        AND qr_links.user_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────
-- click_events: public insert (edge function), owner-only select
-- ───────────────────────────────────────────────
CREATE POLICY "click_events_insert_public" ON public.click_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "click_events_select_owner" ON public.click_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.qr_links
      WHERE qr_links.id = click_events.link_id
        AND qr_links.user_id = auth.uid()
    )
  );
