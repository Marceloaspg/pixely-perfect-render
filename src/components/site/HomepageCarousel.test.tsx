import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryDataSchema, productDataSchema, type CatalogData } from "@/data/catalog";
import type { HomepageBanner } from "@/lib/homepage-banners";
import { HomepageCarousel } from "./HomepageCarousel";

const homepageMocks = vi.hoisted(() => ({
  banners: vi.fn(),
  featuredProducts: vi.fn(),
  catalog: null as unknown as CatalogData,
}));

vi.mock("@/lib/catalog.functions", () => ({
  getHomepageBanners: homepageMocks.banners,
  getHomepageFeaturedProductSlugs: homepageMocks.featuredProducts,
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => homepageMocks.catalog,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

function banner(id: string, title: string): HomepageBanner {
  return {
    id,
    type: "campaign",
    title,
    subtitle: `Mensagem ${title}`,
    imagePath: `banners/${id}.webp`,
    mobileImagePath: null,
    buttonLabel: "Saiba mais",
    buttonHref: "/produtos",
    productSlug: null,
    displayOrder: Number(id.slice(-1)),
    active: true,
    startsAt: null,
    endsAt: null,
    imageUrl: `/signed/${id}.webp`,
    mobileImageUrl: "",
    archivedAt: null,
  };
}

function renderCarousel(initialBanners?: HomepageBanner[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  if (initialBanners) queryClient.setQueryData(["homepage-banners"], initialBanners);
  return render(
    <QueryClientProvider client={queryClient}>
      <HomepageCarousel />
    </QueryClientProvider>,
  );
}

describe("HomepageCarousel", () => {
  beforeEach(() => {
    homepageMocks.banners.mockReset();
    homepageMocks.featuredProducts.mockReset().mockResolvedValue([]);
    homepageMocks.catalog = {
      products: [],
      categories: [],
      config: { whatsapp: "5511999999999", email: "", instagram: "", facebook: "" },
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not render an empty campaign section when no managed banners are available", async () => {
    homepageMocks.banners.mockRejectedValue(new Error("query offline"));
    renderCarousel();
    await act(async () => {});
    expect(
      screen.queryByRole("heading", { name: "Campanhas e novidades" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Campanhas da Majesta Embalagens" }),
    ).not.toBeInTheDocument();
  });

  it("hides carousel controls when only one eligible banner exists", async () => {
    homepageMocks.banners.mockResolvedValue([
      banner("10000000-0000-4000-8000-000000000001", "Campanha única"),
    ]);
    renderCarousel();
    expect(await screen.findByRole("heading", { name: "Campanha única" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Campanha anterior" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Próxima campanha" })).not.toBeInTheDocument();
  });

  it("does not render banners linked to inactive products or inactive categories", async () => {
    homepageMocks.banners.mockResolvedValue([
      banner("10000000-0000-4000-8000-000000000001", "Banner vinculado"),
    ]);
    const linkedBanner = {
      ...banner("10000000-0000-4000-8000-000000000001", "Banner vinculado"),
      productSlug: "produto-inativo",
    };
    homepageMocks.banners.mockResolvedValue([linkedBanner]);
    homepageMocks.catalog = {
      products: [
        {
          ...productDataSchema.parse({
            name: "Produto inativo",
            description: "",
            imagePath: "catalog/inativo.webp",
          }),
          slug: "produto-inativo",
          category: "inativa",
          active: false,
          image: "/signed/inativo.webp",
          additionalImages: [],
        },
      ],
      categories: [
        {
          ...categoryDataSchema.parse({ name: "Categoria inativa" }),
          slug: "inativa",
          active: false,
          image: "",
        },
      ],
      config: { whatsapp: "5511999999999", email: "", instagram: "", facebook: "" },
    };

    renderCarousel([linkedBanner]);
    await act(async () => {});
    expect(screen.queryByRole("heading", { name: "Banner vinculado" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Campanhas da Majesta Embalagens" }),
    ).not.toBeInTheDocument();
  });

  it("supports manual navigation, keyboard arrows, and touch swipes", async () => {
    homepageMocks.banners.mockResolvedValue([
      banner("10000000-0000-4000-8000-000000000001", "Campanha um"),
      banner("10000000-0000-4000-8000-000000000002", "Campanha dois"),
    ]);
    renderCarousel();
    const firstHeading = await screen.findByRole("heading", { name: "Campanha um" });
    const region = screen.getByRole("region", { name: "Campanhas da Majesta Embalagens" });

    fireEvent.click(screen.getByRole("button", { name: "Próxima campanha" }));
    expect(await screen.findByRole("heading", { name: "Campanha dois" })).toBeInTheDocument();
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(await screen.findByRole("heading", { name: "Campanha um" })).toBeInTheDocument();
    fireEvent.pointerDown(region, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(region, { clientX: 220, clientY: 103 });
    expect(await screen.findByRole("heading", { name: "Campanha dois" })).toBeInTheDocument();
    expect(firstHeading).toBeInTheDocument();
  });

  it("rotates through multiple banners every seven seconds", async () => {
    const banners = [
      banner("10000000-0000-4000-8000-000000000001", "Campanha um"),
      banner("10000000-0000-4000-8000-000000000002", "Campanha dois"),
    ];
    vi.useFakeTimers();
    renderCarousel(banners);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: "Campanha um" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(screen.getByRole("heading", { name: "Campanha dois" })).toBeInTheDocument();
  });

  it("pauses rotation while the visitor is interacting and resumes after interaction", async () => {
    const banners = [
      banner("10000000-0000-4000-8000-000000000001", "Campanha um"),
      banner("10000000-0000-4000-8000-000000000002", "Campanha dois"),
    ];
    vi.useFakeTimers();
    renderCarousel(banners);
    await act(async () => {});
    const region = screen.getByRole("region", { name: "Campanhas da Majesta Embalagens" });
    fireEvent.mouseEnter(region);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(screen.getByRole("heading", { name: "Campanha um" })).toBeInTheDocument();
    fireEvent.mouseLeave(region);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7000);
    });
    expect(screen.getByRole("heading", { name: "Campanha dois" })).toBeInTheDocument();
  });

  it("does not autoplay when reduced motion is preferred", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.useFakeTimers();
    renderCarousel([
      banner("10000000-0000-4000-8000-000000000001", "Campanha um"),
      banner("10000000-0000-4000-8000-000000000002", "Campanha dois"),
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(screen.getByRole("heading", { name: "Campanha um" })).toBeInTheDocument();
  });
});
