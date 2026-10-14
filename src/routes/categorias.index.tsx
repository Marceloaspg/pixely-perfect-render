import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/components/site/CategoriesPage";

export const Route = createFileRoute("/categorias/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Categorias de embalagens | Majesta Embalagens" },
      { name: "description", content: "Explore nossas categorias de embalagens e encontre a solução ideal para o seu negócio." },
      { property: "og:title", content: "Categorias de embalagens | Majesta Embalagens" },
      { property: "og:description", content: "Encontre a embalagem ideal para o seu negócio." },
    ],
  }),
  component: CategoriesPage,
});
