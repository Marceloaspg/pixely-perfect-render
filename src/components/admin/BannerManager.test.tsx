import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/data/catalog";
import type { HomepageBanner } from "@/lib/homepage-banners";
import { BannerManager } from "./BannerManager";

const managerMocks = vi.hoisted(() => ({
  archive: vi.fn(),
  load: vi.fn(),
  reorder: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/lib/catalog.functions", () => ({
  archiveHomepageBanner: managerMocks.archive,
  getAdminHomepageBanners: managerMocks.load,
  reorderHomepageBanners: managerMocks.reorder,
  saveHomepageBanner: managerMocks.save,
  uploadCatalogImage: managerMocks.upload,
}));

vi.mock("@/components/admin/ImageCropDialog", () => ({
  ImageCropDialog: () => null,
}));

function banner(id: string, title: string, type: HomepageBanner["type"]): HomepageBanner {
  return {
    id,
    type,
    title,
    subtitle: `Descrição ${title}`,
    imagePath: type === "product" ? null : `banners/${id}.webp`,
    mobileImagePath: null,
    buttonLabel: "Conheça",
    buttonHref: "/produtos",
    productSlug: type === "product" ? "caixa" : null,
    displayOrder: Number(id.slice(-1)),
    active: true,
    startsAt: null,
    endsAt: null,
    imageUrl: `/signed/${id}.webp`,
    mobileImageUrl: "",
    archivedAt: null,
  };
}

function renderManager(banners: HomepageBanner[]) {
  managerMocks.load.mockResolvedValue(banners);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  queryClient.setQueryData(["admin-homepage-banners"], banners);
  return render(
    <QueryClientProvider client={queryClient}>
      <BannerManager products={[] as Product[]} />
    </QueryClientProvider>,
  );
}

describe("BannerManager", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("separates the hero from campaign and product content", () => {
    renderManager([
      banner("10000000-0000-4000-8000-000000000001", "Principal", "institutional"),
      banner("10000000-0000-4000-8000-000000000002", "Campanha", "campaign"),
      banner("10000000-0000-4000-8000-000000000003", "Produto", "product"),
    ]);

    const heroSection = screen.getByRole("heading", { name: "Banner principal" }).closest("section");
    const campaignSection = screen
      .getByRole("heading", { name: "Campanhas e novidades" })
      .closest("section");
    expect(heroSection).not.toBeNull();
    expect(campaignSection).not.toBeNull();
    expect(within(heroSection!).getByText("Principal", { selector: "p" })).toBeInTheDocument();
    expect(within(heroSection!).queryByText("Campanha", { selector: "p" })).not.toBeInTheDocument();
    expect(within(campaignSection!).getByText("Campanha", { selector: "p" })).toBeInTheDocument();
    expect(within(campaignSection!).getByText("Produto", { selector: "p" })).toBeInTheDocument();
  });

  it("locks new hero banners to the institutional group while keeping campaign types separate", () => {
    renderManager([]);

    fireEvent.click(screen.getByRole("button", { name: "Novo banner principal" }));
    let typeSelect = screen.getByLabelText("Tipo de banner");
    expect(typeSelect).toBeDisabled();
    expect(within(typeSelect).getAllByRole("option")).toHaveLength(1);
    expect(within(typeSelect).getByRole("option", { name: "Banner principal" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Nova campanha ou novidade" }));
    typeSelect = screen.getByLabelText("Tipo de banner");
    expect(typeSelect).toBeEnabled();
    expect(within(typeSelect).queryByRole("option", { name: "Banner principal" })).not.toBeInTheDocument();
    expect(within(typeSelect).getByRole("option", { name: "Campanha comercial" })).toBeInTheDocument();
    expect(within(typeSelect).getByRole("option", { name: "Produto em destaque" })).toBeInTheDocument();
  });
});
