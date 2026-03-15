-- Restrict click_events INSERT to service role only.
-- The edge function (redirect/index.ts) uses SUPABASE_SERVICE_ROLE_KEY which bypasses
-- RLS entirely, so it does not need an explicit policy.
-- Removing the public INSERT policy prevents anonymous clients from spamming analytics.

DROP POLICY IF EXISTS "click_events_insert_public" ON public.click_events;
