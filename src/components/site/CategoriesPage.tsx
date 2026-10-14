import { Link } from "@tanstack/react-router";
import { ArrowRight, Package } from "lucide-react";
import { PageHero } from "@/components/site/Layout";
import { useCatalog } from "@/lib/catalog-context";

export function CategoriesPage() {
  const { categories } = useCatalog();
  const visibleCategories = categories.filter(category => category.active);

  return (
    <>
      <PageHero
        eyebrow="Categorias"
        title="Explore nossas categorias"
        text="Encontre a embalagem ideal para o seu negócio."
      />
      <section aria-label="Categorias de embalagens" className="mx-auto max-w-7xl px-5 py-12">
        {visibleCategories.length > 0 ? (
          <ul className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCategories.map(category => {
              const hasAssignedImage = Boolean(category.imagePath || category.imageKey !== "burger");
              return (
                <li key={category.slug} className="h-full">
                  <Link
                    to="/categorias/$slug"
                    params={{ slug: category.slug }}
                    aria-label={`Ver categoria ${category.name}`}
                    className="group flex h-full min-h-56 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1 hover:border-gold hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                  >
                    <div className="flex aspect-[16/8] items-center justify-center overflow-hidden bg-secondary">
                      {hasAssignedImage && category.image ? (
                        <img
                          src={category.image}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <Package aria-hidden="true" className="h-12 w-12 text-navy/45" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="font-bold text-navy">{category.name}</h2>
                      {category.description && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
                      )}
                      <span className="mt-auto flex items-center gap-2 pt-5 font-semibold text-navy">
                        Ver produtos
                        <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-gold transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
            No momento, não há categorias disponíveis. Volte em breve para conhecer nossas opções.
          </p>
        )}
      </section>
    </>
  );
}
