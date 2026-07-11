import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { orgQueries } from "@/features/admin/organization-queries";
import { applyFavicon } from "@/lib/favicon";

/** Keeps the browser-tab favicon in sync with the company logo. Renders nothing. */
export function FaviconManager() {
  const { data: company } = useQuery(orgQueries.company());

  useEffect(() => {
    applyFavicon(company?.logo_url ?? null);
  }, [company?.logo_url]);

  return null;
}
