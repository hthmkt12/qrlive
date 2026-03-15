-- Atomic geo routes replace: delete + insert in one transaction.
-- Prevents partial state where a failed insert leaves a link with no routes.
CREATE OR REPLACE FUNCTION upsert_geo_routes(
  p_link_id UUID,
  p_routes  JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove all existing routes for this link
  DELETE FROM geo_routes WHERE link_id = p_link_id;

  -- Insert new routes (skip rows with missing country_code or target_url)
  IF jsonb_array_length(p_routes) > 0 THEN
    INSERT INTO geo_routes (link_id, country, country_code, target_url, bypass_url)
    SELECT
      p_link_id,
      r->>'country',
      r->>'country_code',
      r->>'target_url',
      NULLIF(r->>'bypass_url', '')
    FROM jsonb_array_elements(p_routes) AS r
    WHERE (r->>'country_code') IS NOT NULL AND (r->>'country_code') <> ''
      AND (r->>'target_url')   IS NOT NULL AND (r->>'target_url')   <> '';
  END IF;
END;
$$;
