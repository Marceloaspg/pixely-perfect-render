import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save,
  Upload,
} from "lucide-react";
import type { Product } from "@/data/catalog";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";
import {
  archiveHomepageBanner,
  getAdminHomepageBanners,
  reorderHomepageBanners,
  saveHomepageBanner,
  uploadCatalogImage,
} from "@/lib/catalog.functions";
import {
  homepageBannerSchema,
  type HomepageBanner,
  type HomepageBannerType,
} from "@/lib/homepage-banners";

type BannerForm = {
  id?: string;
  type: HomepageBannerType;
  title: string;
  subtitle: string;
  imagePath: string | null;
  mobileImagePath: string | null;
  buttonLabel: string;
  buttonHref: string;
  productSlug: string | null;
  displayOrder: number;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const bannersQuery = queryOptions({
  queryKey: ["admin-homepage-banners"],
  queryFn: () => getAdminHomepageBanners(),
});

function createForm(displayOrder: number): BannerForm {
  return {
    type: "institutional",
    title: "",
    subtitle: "",
    imagePath: null,
    mobileImagePath: null,
    buttonLabel: "",
    buttonHref: "",
    productSlug: null,
    displayOrder,
    active: false,
    startsAt: "",
    endsAt: "",
  };
}

function localDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toForm(banner: HomepageBanner): BannerForm {
  return {
    id: banner.id,
    type: banner.type,
    title: banner.title,
    subtitle: banner.subtitle,
    imagePath: banner.imagePath,
    mobileImagePath: banner.mobileImagePath,
    buttonLabel: banner.buttonLabel,
    buttonHref: banner.buttonHref,
    productSlug: banner.productSlug,
    displayOrder: banner.displayOrder,
    active: banner.active,
    startsAt: localDateTime(banner.startsAt),
    endsAt: localDateTime(banner.endsAt),
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("Não foi possível ler a imagem processada."));
    reader.readAsDataURL(file);
  });
}

export function BannerManager({ products }: { products: Product[] }) {
  const queryClient = useQueryClient();
  const { data: banners = [], isLoading, error: loadError } = useQuery(bannersQuery);
  const uploadImage = useServerFn(uploadCatalogImage);
  const saveBanner = useServerFn(saveHomepageBanner);
  const archiveBanner = useServerFn(archiveHomepageBanner);
  const saveOrder = useServerFn(reorderHomepageBanners);
  const [form, setForm] = useState<BannerForm | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewUrls = useRef(new Set<string>());
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<"desktop" | "mobile">("desktop");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ordered = [...banners].sort(
    (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
  );

  useEffect(
    () => () => {
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  function previewFor(path: string | null, fallback = ""): string {
    return path
      ? (previews[path] ??
          banners.find((banner) => banner.imagePath === path)?.imageUrl ??
          banners.find((banner) => banner.mobileImagePath === path)?.mobileImageUrl ??
          fallback)
      : fallback;
  }

  async function refreshBanners() {
    await queryClient.invalidateQueries({ queryKey: ["admin-homepage-banners"] });
    await queryClient.invalidateQueries({ queryKey: ["homepage-banners"] });
  }

  function startNew() {
    setMessage("");
    setForm(createForm(ordered.length));
  }

  function startEdit(banner: HomepageBanner) {
    setMessage("");
    setForm(toForm(banner));
  }

  async function handleUpload(file: File) {
    setBusy(true);
    setMessage("Enviando imagem otimizada...");
    try {
      const result = await uploadImage({
        data: {
          purpose: "banner",
          contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
          base64: await fileToBase64(file),
        },
      });
      const url = URL.createObjectURL(file);
      previewUrls.current.add(url);
      setPreviews((current) => ({ ...current, [result.path]: url }));
      setForm(
        (current) =>
          current && {
            ...current,
            [cropTarget === "desktop" ? "imagePath" : "mobileImagePath"]: result.path,
          },
      );
      setMessage("Imagem enviada. Salve o banner para associá-la ao conteúdo.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível enviar a imagem do banner.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!form) return;
    const startsAt = form.startsAt ? new Date(form.startsAt) : null;
    const endsAt = form.endsAt ? new Date(form.endsAt) : null;
    if (
      (startsAt && !Number.isFinite(startsAt.getTime())) ||
      (endsAt && !Number.isFinite(endsAt.getTime()))
    ) {
      setMessage("Informe datas válidas para o período de exibição.");
      return;
    }
    const parsed = homepageBannerSchema.safeParse({
      ...form,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Revise os campos do banner.");
      return;
    }
    setBusy(true);
    setMessage("Salvando banner...");
    try {
      await saveBanner({ data: parsed.data });
      setForm(null);
      for (const url of previewUrls.current) URL.revokeObjectURL(url);
      previewUrls.current.clear();
      setPreviews({});
      setMessage("Banner salvo.");
      await refreshBanners();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar o banner.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(banner: HomepageBanner) {
    if (!window.confirm(`Arquivar “${banner.title}”? O registro e as imagens serão preservados.`))
      return;
    setBusy(true);
    setMessage("");
    try {
      await archiveBanner({ data: { id: banner.id } });
      setMessage("Banner arquivado. Seus dados e fotografias foram preservados.");
      await refreshBanners();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível arquivar o banner.");
    } finally {
      setBusy(false);
    }
  }

  async function moveBanner(id: string, direction: -1 | 1) {
    const index = ordered.findIndex((banner) => banner.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setBusy(true);
    setMessage("");
    try {
      await saveOrder({ data: { ids: next.map((banner) => banner.id) } });
      setMessage("Ordem dos banners atualizada.");
      await refreshBanners();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível reorganizar os banners.",
      );
    } finally {
      setBusy(false);
    }
  }

  const linkedProduct = products.find((product) => product.slug === form?.productSlug);
  const formImage =
    form?.type === "product" ? (linkedProduct?.image ?? "") : previewFor(form?.imagePath ?? null);
  const formMobileImage = previewFor(form?.mobileImagePath ?? null, formImage);
  const actionHref = form?.productSlug
    ? `/produtos/${encodeURIComponent(form.productSlug)}`
    : (form?.buttonHref ?? "");

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy">Banners e Campanhas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie conteúdo da página inicial. Produtos em destaque elegíveis também aparecem
            automaticamente.
          </p>
        </div>
        {!form && (
          <Button onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo banner
          </Button>
        )}
      </div>

      {message && (
        <p
          role="status"
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-navy"
        >
          {message}
        </p>
      )}
      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p>
            Não foi possível carregar os banners.{" "}
            {loadError instanceof Error ? loadError.message : ""}
          </p>
          <Button variant="outline" className="mt-3" onClick={() => void refreshBanners()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {isLoading && (
        <p
          role="status"
          className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground"
        >
          Carregando banners...
        </p>
      )}

      {!isLoading && !loadError && !form && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
          {ordered.map((banner, index) => {
            const image =
              banner.imageUrl ||
              products.find((product) => product.slug === banner.productSlug)?.image ||
              "";
            return (
              <article
                key={banner.id}
                className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mover ${banner.title} para cima`}
                      disabled={busy || index === 0}
                      onClick={() => void moveBanner(banner.id, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mover ${banner.title} para baixo`}
                      disabled={busy || index === ordered.length - 1}
                      onClick={() => void moveBanner(banner.id, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold text-navy">{banner.title}</p>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize">
                      {banner.type === "campaign"
                        ? "Campanha"
                        : banner.type === "product"
                          ? "Produto"
                          : "Institucional"}
                    </span>
                    <span
                      className={`text-xs font-semibold ${banner.archivedAt ? "text-muted-foreground" : banner.active ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {banner.archivedAt ? "Arquivado" : banner.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {banner.subtitle}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ordem {index + 1}
                    {banner.startsAt || banner.endsAt
                      ? ` · ${banner.startsAt ? new Date(banner.startsAt).toLocaleDateString("pt-BR") : "Sem início"} — ${banner.endsAt ? new Date(banner.endsAt).toLocaleDateString("pt-BR") : "Sem término"}`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !!banner.archivedAt}
                    onClick={() => startEdit(banner)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !!banner.archivedAt}
                    onClick={() => void handleArchive(banner)}
                  >
                    <Archive className="mr-1 h-3.5 w-3.5" />
                    Arquivar
                  </Button>
                </div>
              </article>
            );
          })}
          {ordered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum banner cadastrado. O hero institucional atual continuará sendo exibido até a
              publicação de conteúdo elegível.
            </p>
          )}
        </div>
      )}

      {form && (
        <div className="grid gap-6 rounded-2xl border border-border bg-card p-5 shadow-card lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-navy">{form.id ? "Editar banner" : "Novo banner"}</h3>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setForm(null)}>
                Cancelar
              </Button>
            </div>
            <label className="block text-sm font-semibold">
              Tipo de banner
              <select
                className="admin-input mt-1"
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as HomepageBannerType })
                }
              >
                <option value="institutional">Institucional</option>
                <option value="campaign">Campanha comercial</option>
                <option value="product">Produto em destaque</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Título *
              <input
                className="admin-input mt-1"
                maxLength={120}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label className="block text-sm font-semibold">
              Subtítulo
              <textarea
                className="admin-input mt-1 min-h-20"
                maxLength={500}
                value={form.subtitle}
                onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
              />
            </label>

            {form.type === "product" ? (
              <label className="block text-sm font-semibold">
                Produto cadastrado *
                <select
                  className="admin-input mt-1"
                  value={form.productSlug ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, productSlug: event.target.value || null })
                  }
                >
                  <option value="">Selecione um produto</option>
                  {products.map((product) => (
                    <option key={product.slug} value={product.slug}>
                      {product.name}
                      {product.demo ? " — demonstrativo" : ""}
                      {!product.active ? " — inativo" : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Para publicação, o produto precisa estar ativo, marcado como destaque, não ser
                  demonstrativo e possuir fotografia; sua categoria também precisa estar ativa.
                </span>
              </label>
            ) : (
              <>
                <label className="block text-sm font-semibold">
                  Fotografia horizontal *
                  <span className="mt-2 flex items-center gap-3">
                    <span className="flex aspect-video w-32 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                      {formImage ? (
                        <img
                          src={formImage}
                          alt="Prévia do banner"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </span>
                    <span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        id="homepage-banner-image"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) {
                            setCropTarget("desktop");
                            setCropFile(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                      <Button asChild type="button" variant="outline">
                        <label htmlFor="homepage-banner-image" className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          Enviar ou substituir
                        </label>
                      </Button>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Corte horizontal 16:9, otimizado antes do upload.
                      </span>
                    </span>
                  </span>
                </label>
                <label className="block text-sm font-semibold">
                  Imagem para celular (opcional)
                  <span className="mt-2 flex items-center gap-3">
                    <span className="flex aspect-video w-32 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                      {formMobileImage ? (
                        <img
                          src={formMobileImage}
                          alt="Prévia do banner para celular"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </span>
                    <span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        id="homepage-banner-mobile-image"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) {
                            setCropTarget("mobile");
                            setCropFile(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                      <Button asChild type="button" variant="outline">
                        <label htmlFor="homepage-banner-mobile-image" className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          Enviar imagem móvel
                        </label>
                      </Button>
                      {form.mobileImagePath && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setForm({ ...form, mobileImagePath: null })}
                        >
                          Remover associação
                        </Button>
                      )}
                    </span>
                  </span>
                </label>
              </>
            )}

            {form.type !== "product" && (
              <>
                <label className="block text-sm font-semibold">
                  Texto do botão
                  <input
                    className="admin-input mt-1"
                    maxLength={60}
                    value={form.buttonLabel}
                    onChange={(event) => setForm({ ...form, buttonLabel: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Produto de destino (opcional)
                  <select
                    className="admin-input mt-1"
                    value={form.productSlug ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, productSlug: event.target.value || null })
                    }
                  >
                    <option value="">Usar destino por URL</option>
                    {products.map((product) => (
                      <option key={product.slug} value={product.slug}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!form.productSlug && (
                  <label className="block text-sm font-semibold">
                    Destino do botão (caminho interno ou HTTPS)
                    <input
                      className="admin-input mt-1"
                      maxLength={500}
                      placeholder="/produtos ou https://..."
                      value={form.buttonHref}
                      onChange={(event) => setForm({ ...form, buttonHref: event.target.value })}
                    />
                  </label>
                )}
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Início da exibição (opcional)
                <input
                  type="datetime-local"
                  className="admin-input mt-1"
                  value={form.startsAt}
                  onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Fim da exibição (opcional)
                <input
                  type="datetime-local"
                  className="admin-input mt-1"
                  value={form.endsAt}
                  onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Ativo (respeitando o período de exibição)
            </label>
            <div className="flex flex-wrap gap-3 border-t border-border pt-4">
              <Button type="button" disabled={busy} onClick={() => void handleSave()}>
                <Save className="mr-2 h-4 w-4" />
                {busy ? "Salvando..." : "Salvar banner"}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>
                Cancelar edição
              </Button>
            </div>
          </div>

          <aside aria-label="Pré-visualização do banner" className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">
              Pré-visualização
            </h3>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-navy">
              {formImage && (
                <picture>
                  {formMobileImage && formMobileImage !== formImage && (
                    <source media="(max-width: 639px)" srcSet={formMobileImage} />
                  )}
                  <img
                    src={formImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </picture>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/80 to-navy/10" />
              <div className="relative flex h-full flex-col justify-center p-6 text-primary-foreground sm:p-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
                  Majesta Embalagens
                </p>
                <p className="mt-2 max-w-[75%] text-xl font-extrabold sm:text-2xl">
                  {form.title || "Título do banner"}
                </p>
                <p className="mt-2 max-w-[70%] text-xs text-primary-foreground/80 sm:text-sm">
                  {form.subtitle || "O subtítulo aparecerá nesta área da página inicial."}
                </p>
                {form.buttonLabel && (
                  <span className="mt-4 w-fit rounded-full bg-gold px-4 py-2 text-xs font-bold text-navy">
                    {form.buttonLabel}
                  </span>
                )}
              </div>
            </div>
            {actionHref && form.buttonLabel && (
              <a
                className="inline-flex text-sm font-semibold text-primary underline"
                href={actionHref}
                target={actionHref.startsWith("https://") ? "_blank" : undefined}
                rel={actionHref.startsWith("https://") ? "noreferrer" : undefined}
              >
                Testar destino do botão
              </a>
            )}
          </aside>
        </div>
      )}

      <ImageCropDialog
        file={cropFile}
        aspectRatio="16/9"
        onCancel={() => setCropFile(null)}
        onConfirm={(file) => {
          setCropFile(null);
          void handleUpload(file);
        }}
      />
    </section>
  );
}
