import { supabase } from "@/integrations/supabase/client";

export async function purgeLinkMetadataCacheQuietly(shortCode?: string | null) {
  if (!shortCode) return;

  try {
    const { error } = await supabase.functions.invoke("link-cache-invalidate", {
      body: { shortCode },
    });

    if (error) {
      console.warn("Khong the xoa cache link Redis:", error);
    }
  } catch (error) {
    console.warn("Khong the xoa cache link Redis:", error);
  }
}
