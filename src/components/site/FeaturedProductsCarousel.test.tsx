import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryDataSchema, productDataSchema } from "@/data/catalog";
import type { CatalogData } from "@/data/catalog";
import { FeaturedProductsCarousel } from "./FeaturedProductsCarousel";

const featuredMocks = vi.hoisted(() => ({
  slugs: vi.fn(),
  banners: vi.fn(),
  catalog: null as unknown as CatalogData,
}));

const carouselHarness = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>();
  const state = { snapCount: 1, selected: 0, options: null as null | { loop: boolean } };
  const emit = (event: string) => listeners.get(event)?.forEach((listener) => listener());
  const api = {
    canScrollNext: vi.fn(() => state.snapCount > 1),
    canScrollPrev: vi.fn(() => state.snapCount > 1),
    scrollNext: vi.fn(() => {
      state.selected = (state.selected + 1) % state.snapCount;
      emit("select");
    }),
    scrollPrev: vi.fn(() => {
      state.selected = (state.selected - 1 + state.snapCount) % state.snapCount;
      emit("select");
    }),
    scrollTo: vi.fn((snap: number) => {
      state.selected = Math.max(0, Math.min(snap, state.snapCount - 1));
      emit("select");
    }),
    selectedScrollSnap: vi.fn(() => state.selected),
    scrollSnapList: vi.fn(() => Array.from({ length: state.snapCount }, (_, index) => index)),
    on: vi.fn((event: string, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    }),
    off: vi.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    }),
  };
  return {
    state,
    api,
    reset() {
      state.snapCount = 1;
      state.selected = 0;
      state.options = null;
      listeners.clear();
      Object.values(api).forEach((method) => {
        if (typeof method === "function" && "mockClear" in method) method.mockClear();
      });
    },
  };
});

vi.mock("@/lib/catalog.functions", () => ({
  getHomepageFeaturedProductSlugs: featuredMocks.slugs,
  getHomepageBanners: featuredMocks.banners,
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => featuredMocks.catalog,
}));

vi.mock("embla-carousel-react", () => ({
  default: (options: { loop: boolean }) => {
    carouselHarness.state.options = options;
    return [vi.fn(), carouselHarness.api];
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params: { slug: string };
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={`${to.replace("$slug", params.slug)}`} {...props}>
      {children}
    </a>
  ),
}));

function createProduct(slug: string) {
  return {
    ...productDataSchema.parse({
      name: `Produto ${slug}`,
      description: "",
      featured: true,
      imagePath: `catalog/${slug}.webp`,
    }),
    slug,
    category: "embalagens",
    active: true,
    image: `/signed/${slug}.webp`,
    imageAvailable: true,
    additionalImages: [],
  };
}

function renderFeatured(
  products: ReturnType<typeof createProduct>[],
  eligibleSlugs: string[],
  categoryActive = true,
) {
  const visibleCount = window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 2 : 1;
  carouselHarness.state.snapCount = Math.max(1, products.length - visibleCount + 1);
  carouselHarness.state.selected = 0;
  featuredMocks.catalog = {
    products,
    categories: [
      {
        ...categoryDataSchema.parse({ name: "Embalagens" }),
        slug: "embalagens",
        active: categoryActive,
        image: "",
      },
    ],
    config: { whatsapp: "5511999999999", email: "", instagram: "", facebook: "" },
  };
  featuredMocks.slugs.mockResolvedValue(eligibleSlugs);
  featuredMocks.banners.mockResolvedValue([]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  queryClient.setQueryData(["homepage-featured-products"], eligibleSlugs);
  queryClient.setQueryData(["homepage-banners"], []);
  return render(
    <QueryClientProvider client={queryClient}>
      <FeaturedProductsCarousel />
    </QueryClientProvider>,
  );
}

describe("FeaturedProductsCarousel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    carouselHarness.reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows real featured products with their detail links and fixed image areas", () => {
    renderFeatured([createProduct("caixa-1"), createProduct("caixa-2")], ["caixa-1", "caixa-2"]);

    expect(screen.getByRole("heading", { name: "Produtos em Destaque" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Veja mais sobre Produto/ })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Veja mais sobre Produto caixa-1/ })).toHaveAttribute(
      "href",
      "/produtos/caixa-1",
    );
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getAllByRole("img")[0]?.parentElement).toHaveClass("h-[280px]", "max-w-[280px]");
    expect(screen.getAllByRole("img")[0]).toHaveClass("block", "min-h-0", "object-contain");
    expect(screen.getByRole("region", { name: "Produtos em destaque" })).toHaveClass(
      "overflow-hidden",
    );
    expect(screen.queryByRole("button", { name: "Próximos produtos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar posição/ })).not.toBeInTheDocument();
  });

  it("renders only server-approved, active, non-demo products with available photos", () => {
    const products = [
      createProduct("eligible"),
      { ...createProduct("inactive"), active: false },
      { ...createProduct("demo"), demo: true },
      { ...createProduct("missing-photo"), image: "", imagePath: "" },
      { ...createProduct("missing-url"), imageAvailable: false },
    ];
    renderFeatured(products, ["eligible", "inactive", "demo", "missing-photo", "missing-url"]);

    expect(screen.getAllByRole("link", { name: /Veja mais sobre Produto/ })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Produto eligible" })).toBeInTheDocument();
  });

  it("excludes products belonging to an inactive category even when server slugs are stale", () => {
    renderFeatured([createProduct("inactive-category")], ["inactive-category"], false);
    expect(screen.queryByRole("heading", { name: "Produtos em Destaque" })).not.toBeInTheDocument();
  });

  it("uses Embla looping and wraps manual navigation from both ends without duplicating product cards", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );
    expect(carouselHarness.state.options).toEqual({ align: "start", containScroll: "trimSnaps", slidesToScroll: 1, loop: true });
    expect(screen.getAllByRole("group", { name: /Produto/ })).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Produtos anteriores" }));
    expect(carouselHarness.state.selected).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Próximos produtos" }));
    expect(carouselHarness.state.selected).toBe(0);
    expect(screen.getAllByRole("group", { name: /Produto/ })).toHaveLength(3);
  });

  it("hides the featured-products section and controls for zero or one product", () => {
    const empty = renderFeatured([], []);
    expect(empty.container).toBeEmptyDOMElement();
    empty.unmount();
    cleanup();

    renderFeatured([createProduct("only")], ["only"]);
    expect(screen.getByRole("heading", { name: "Produtos em Destaque" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Produtos anteriores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Próximos produtos" })).not.toBeInTheDocument();
  });

  it("omits products already represented by a managed product banner", () => {
    featuredMocks.catalog = {
      products: [createProduct("linked"), createProduct("unlinked")],
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
    featuredMocks.slugs.mockResolvedValue(["linked", "unlinked"]);
    featuredMocks.banners.mockResolvedValue([{ type: "product", productSlug: "linked" }]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    queryClient.setQueryData(["homepage-featured-products"], ["linked", "unlinked"]);
    queryClient.setQueryData(["homepage-banners"], [{ type: "product", productSlug: "linked" }]);
    render(
      <QueryClientProvider client={queryClient}>
        <FeaturedProductsCarousel />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("heading", { name: "Produto linked" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produto unlinked" })).toBeInTheDocument();
  });

  it("omits the entire section when there are no eligible catalog products", () => {
    const { container } = renderFeatured([createProduct("not-featured")], []);
    expect(container).toBeEmptyDOMElement();
  });

  it("supports keyboard navigation and indicators for each product position", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );
    const rail = screen.getByRole("region", { name: "Produtos em destaque" });

    expect(screen.getAllByRole("button", { name: /Mostrar posição/ })).toHaveLength(3);
    fireEvent.keyDown(rail, { key: "ArrowRight" });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar posição 3 de 3" }));
    expect(carouselHarness.api.scrollTo).toHaveBeenLastCalledWith(2, true);
  });

  it("centers the section heading and places navigation arrows beside the carousel", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );
    const title = screen.getByRole("heading", { name: "Produtos em Destaque" });
    const selection = screen.getByText("Seleção Majesta");
    const viewport = screen.getByRole("region", { name: "Produtos em destaque" });
    const row = viewport.parentElement;

    expect(title).toHaveClass("text-center");
    expect(selection.parentElement).toHaveClass("text-center");
    expect(row?.children[0]).toHaveAttribute("aria-label", "Produtos anteriores");
    expect(row?.children[1]).toBe(viewport);
    expect(row?.children[2]).toHaveAttribute("aria-label", "Próximos produtos");
  });

  it("uses responsive slide widths for desktop, tablet, and phone", () => {
    const products = Array.from({ length: 7 }, (_, index) => createProduct(`product-${index}`));
    const slugs = products.map((product) => product.slug);

    const desktop = renderFeatured(products, slugs);
    expect(desktop.container.querySelector('[aria-roledescription="slide"]')).toHaveClass(
      "basis-1/4",
    );
    expect(carouselHarness.state.snapCount).toBe(4);
    desktop.unmount();
    cleanup();

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    const tablet = renderFeatured(products, slugs);
    expect(tablet.container.querySelector('[aria-roledescription="slide"]')).toHaveClass(
      "basis-1/2",
    );
    expect(carouselHarness.state.snapCount).toBe(6);
    tablet.unmount();
    cleanup();

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const phone = renderFeatured(products, slugs);
    expect(phone.container.querySelector('[aria-roledescription="slide"]')).toHaveClass(
      "basis-full",
    );
    expect(carouselHarness.state.snapCount).toBe(7);
  });

  it("advances one snap every two seconds and returns to the first snap at the end", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
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
    vi.useFakeTimers();
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(carouselHarness.api.scrollNext).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledTimes(3);
    expect(carouselHarness.state.selected).toBe(0);
  });

  it("pauses on hover and resumes after the pointer leaves", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
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
    vi.useFakeTimers();
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );
    const section = screen
      .getByRole("heading", { name: "Produtos em Destaque" })
      .closest("section");
    expect(section).not.toBeNull();

    fireEvent.mouseEnter(section!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(carouselHarness.api.scrollNext).not.toHaveBeenCalled();

    fireEvent.mouseLeave(section!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledOnce();
  });

  it("pauses while keyboard focus remains within the carousel", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
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
    vi.useFakeTimers();
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );
    const section = screen
      .getByRole("heading", { name: "Produtos em Destaque" })
      .closest("section");
    expect(section).not.toBeNull();

    fireEvent.focus(screen.getByRole("region", { name: "Produtos em destaque" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(carouselHarness.api.scrollNext).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByRole("region", { name: "Produtos em destaque" }), {
      relatedTarget: document.body,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledOnce();
  });

  it("pauses during touch interaction and respects reduced-motion preferences", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
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
    vi.useFakeTimers();
    renderFeatured(
      [createProduct("one"), createProduct("two"), createProduct("three")],
      ["one", "two", "three"],
    );
    const rail = screen.getByRole("region", { name: "Produtos em destaque" });

    fireEvent.touchStart(rail);
    fireEvent.touchEnd(rail);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(carouselHarness.api.scrollNext).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(carouselHarness.api.scrollNext).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001);
    });
    expect(carouselHarness.api.scrollNext).toHaveBeenCalledOnce();

    cleanup();
    carouselHarness.reset();
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
    renderFeatured(
      [createProduct("four"), createProduct("five"), createProduct("six")],
      ["four", "five", "six"],
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(carouselHarness.api.scrollNext).not.toHaveBeenCalled();
  });
});
