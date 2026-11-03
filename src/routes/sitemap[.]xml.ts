import { createFileRoute } from "@tanstack/react-router";
import { getCatalog } from "@/lib/catalog.functions";
import { createSitemapResponse } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => createSitemapResponse(await getCatalog()),
    },
  },
});
