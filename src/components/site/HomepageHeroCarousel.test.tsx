import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryDataSchema, type CatalogData } from "@/data/catalog";
import type { HomepageBanner } from "@/lib/homepage-banners";
import { HomepageHeroCarousel } from "./HomepageHeroCarousel";

const heroMocks = vi.hoisted(() => ({
  banners: vi.fn(),
  catalog: null as unknown as CatalogData,
}));

vi.mock("@/lib/catalog.functions", () => ({
  getHomepageBanners: heroMocks.banners,
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => heroMocks.catalog,
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
    type: "institutional",
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

function renderHero(banners: HomepageBanner[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  queryClient.setQueryData(["homepage-banners"], banners);
  return render(
    <QueryClientProvider client={queryClient}>
      <HomepageHeroCarousel />
    </QueryClientProvider>,
  );
}

describe("HomepageHeroCarousel", () => {
  beforeEach(() => {
    heroMocks.banners.mockReset().mockResolvedValue([]);
    heroMocks.catalog = {
      products: [],
      categories: [
        {
          ...categoryDataSchema.parse({ name: "Embalagens" }),
          slug: "embalagens",
          active: true,
          image: "",
        },
      ],
      config: { whatsapp: "5511999999999", email: "", instagram: "", facebook: "" },
    };
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("preserves the original hero content and calls to action when no managed slide is active", () => {
    renderHero([]);

    expect(
      screen.getByRole("heading", {
        name: "Embalagens que valorizam seu produto e fortalecem seu negócio.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conheça nossos produtos" })).toHaveAttribute(
      "href",
      "/produtos",
    );
    expect(screen.getByRole("link", { name: "Solicitar orçamento" })).toHaveAttribute(
      "href",
      "/orcamento",
    );
  });

  it("uses institutional slides only and automatically advances every five seconds", async () => {
    vi.useFakeTimers();
    renderHero([
      banner("10000000-0000-4000-8000-000000000001", "Banner principal um"),
      banner("10000000-0000-4000-8000-000000000002", "Banner principal dois"),
      { ...banner("10000000-0000-4000-8000-000000000003", "Campanha"), type: "campaign" },
    ]);

    expect(screen.getByRole("heading", { name: "Banner principal um" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Banner principal da Majesta Embalagens" })
        .querySelector("article"),
    ).toHaveClass("md:min-h-[380px]", "lg:min-h-[400px]");
    expect(screen.queryByRole("heading", { name: "Campanha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /slide|banner/i })).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(screen.getByRole("heading", { name: "Banner principal um" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("heading", { name: "Banner principal dois" })).toBeInTheDocument();
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
    renderHero([
      banner("10000000-0000-4000-8000-000000000001", "Banner principal um"),
      banner("10000000-0000-4000-8000-000000000002", "Banner principal dois"),
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByRole("heading", { name: "Banner principal um" })).toBeInTheDocument();
  });
});
