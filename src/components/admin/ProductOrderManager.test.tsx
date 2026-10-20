import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { productDataSchema, type Product } from "@/data/catalog";
import { ProductOrderManager } from "./ProductOrderManager";

function product(slug: string): Product {
  return {
    ...productDataSchema.parse({
      name: `Produto ${slug}`,
      description: "",
      sku: `SKU-${slug}`,
    }),
    slug,
    category: "embalagens",
    active: true,
    image: "",
    additionalImages: [],
  };
}

function renderManager(onSave = vi.fn()) {
  const products = [product("um"), product("dois"), product("tres")];
  function Harness() {
    const [visible, setVisible] = useState(true);
    return visible ? (
      <ProductOrderManager
        products={products}
        busy={false}
        onSave={onSave}
        onCancel={() => setVisible(false)}
      />
    ) : (
      <p>Organização cancelada</p>
    );
  }
  return render(<Harness />);
}

describe("ProductOrderManager", () => {
  afterEach(cleanup);

  it("shows the complete starting order and persists accessible position changes", () => {
    const save = vi.fn();
    renderManager(save);

    expect(screen.getByLabelText("Posição 1")).toHaveTextContent("1");
    expect(screen.getByLabelText("Posição 2")).toHaveTextContent("2");
    fireEvent.click(screen.getByRole("button", { name: "Mover Produto tres para cima" }));
    const reorderedRows = screen.getAllByRole("listitem");
    expect(within(reorderedRows[1]!).getByText("Produto tres")).toBeInTheDocument();
    expect(within(reorderedRows[2]!).getByText("Produto dois")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar ordem" }));
    expect(save).toHaveBeenCalledWith(["um", "tres", "dois"]);
  });

  it("supports drag and drop without applying filtered-list positions", () => {
    renderManager();
    const rows = screen.getAllByRole("listitem");
    const transfer = {
      effectAllowed: "",
      setData: vi.fn(),
      getData: vi.fn(() => "tres"),
    };

    fireEvent.dragStart(rows[2]!, { dataTransfer: transfer });
    fireEvent.dragOver(rows[0]!, { dataTransfer: transfer });
    fireEvent.drop(rows[0]!, { dataTransfer: transfer });

    const reorderedRows = screen.getAllByRole("listitem");
    expect(within(reorderedRows[0]!).getByText("Produto tres")).toBeInTheDocument();
    expect(within(reorderedRows[1]!).getByText("Produto um")).toBeInTheDocument();
    expect(within(reorderedRows[2]!).getByText("Produto dois")).toBeInTheDocument();
  });

  it("cancels local changes without invoking persistence", () => {
    const save = vi.fn();
    renderManager(save);
    fireEvent.click(screen.getByRole("button", { name: "Mover Produto dois para baixo" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Organização cancelada")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
