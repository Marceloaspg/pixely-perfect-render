import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryDataSchema, productDataSchema, type CatalogData, type Product } from '@/data/catalog';
import { Footer, Header, ProductCard } from './Layout';

const layoutMocks = vi.hoisted(() => ({
  catalog: null as unknown as CatalogData,
  items: [] as Array<{ slug: string; variation?: string }>,
  add: vi.fn<(product: Product, variation?: string) => void>(),
  has: vi.fn<(slug: string, variation?: string) => boolean>(),
  navigate: vi.fn<
    (options: {
      to: string;
      search: (previous: { categoria?: string; q?: string }) => { categoria?: string; q?: string };
    }) => void
  >(),
}));

vi.mock('@/lib/catalog-context', () => ({
  useCatalog: () => layoutMocks.catalog,
}));

vi.mock('@/lib/quote', () => ({
  useQuote: () => ({ items: layoutMocks.items, add: layoutMocks.add, has: layoutMocks.has }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => layoutMocks.navigate,
  Link: ({
    to,
    params,
    children,
    onClick,
    ...props
  }: {
    to: string;
    params?: { slug: string };
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
  }) => (
    <a
      href={params ? to.replace('$slug', params.slug) : to}
      onClick={event => {
        onClick?.(event);
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

function category(slug: string, name: string, active = true) {
  return {
    ...categoryDataSchema.parse({ name }),
    slug,
    active,
    image: '',
  };
}

function setup() {
  layoutMocks.catalog = {
    categories: [
      category('caixas', 'Caixas', true),
      category('sacolas', 'Sacolas', true),
      category('oculta', 'Categoria inativa', false),
    ],
    products: [],
    config: {
      whatsapp: '5519996145193',
      email: '',
      instagram: '',
      facebook: '',
    },
  };
  layoutMocks.items = [{ slug: 'caixa' }];
  layoutMocks.add.mockReset().mockImplementation((product, variation) => {
    if (!layoutMocks.items.some(item => item.slug === product.slug && item.variation === variation)) {
      layoutMocks.items.push({ slug: product.slug, ...(variation ? { variation } : {}) });
    }
  });
  layoutMocks.has.mockReset().mockImplementation((slug, variation) =>
    layoutMocks.items.some(item => item.slug === slug && item.variation === variation),
  );
  layoutMocks.navigate.mockClear();
}

function product(slug: string, description: string, variations: string[] = []): Product {
  return {
    ...productDataSchema.parse({
      name: `Produto ${slug}`,
      description,
      variations,
      imagePath: `catalog/${slug}.webp`,
    }),
    slug,
    category: 'caixas',
    active: true,
    image: `/signed/${slug}.webp`,
    additionalImages: [],
  };
}

describe('site header and footer', () => {
  beforeEach(setup);
  afterEach(cleanup);

  it('shows the requested desktop navigation without solutions by segment', () => {
    render(<Header />);
    const nav = screen.getByRole('navigation');
    const links = within(nav).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual([
      'Início',
      'Catálogo',
      'Produtos',
      'Sobre Nós',
      'Contato',
    ]);
    expect(links[1]).toHaveAttribute('href', '/categorias');
    expect(within(nav).queryByText('Soluções por Segmento')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('uses a direct categories link in the mobile navigation without a submenu', () => {
    render(<Header />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]!);
    const mobileNavigation = screen.getAllByRole('navigation')[1]!;
    const catalogLink = within(mobileNavigation).getByRole('link', { name: 'Catálogo' });
    expect(catalogLink).toHaveAttribute('href', '/categorias');
    expect(within(mobileNavigation).queryByText('Soluções por Segmento')).not.toBeInTheDocument();
    expect(within(mobileNavigation).queryByRole('button', { name: 'Catálogo' })).not.toBeInTheDocument();
    fireEvent.click(catalogLink);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });

  it('renders the compact promo bar with configured and safely opened business links', () => {
    layoutMocks.catalog.config.instagram = 'https://instagram.com/majesta-oficial';
    layoutMocks.catalog.config.facebook = 'https://facebook.com/majesta-oficial';
    render(<Header />);

    expect(screen.getByText('5% OFF pagamento via PIX')).toHaveClass('whitespace-nowrap');
    const instagram = screen.getByRole('link', { name: 'Instagram da Majesta Embalagens' });
    expect(instagram).toHaveAttribute('href', 'https://instagram.com/majesta-oficial');
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
    const facebook = screen.getByRole('link', { name: 'Facebook da Majesta Embalagens' });
    expect(facebook).toHaveAttribute('href', 'https://facebook.com/majesta-oficial');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp da Majesta Embalagens' });
    expect(whatsapp).toHaveAttribute('href', expect.stringContaining('https://wa.me/5519996145193'));
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
    expect(new URL(whatsapp.getAttribute('href')!).searchParams.get('text')).toBe(
      'Olá! Gostaria de solicitar um orçamento com a Majesta Embalagens.',
    );
    expect(whatsapp.querySelectorAll('svg')).toHaveLength(2);
  });

  it('keeps the larger mobile menu first and the quote control without a second WhatsApp action', () => {
    render(<Header />);
    const menu = screen.getByRole('button', { name: 'Menu' });
    const mobileRow = menu.parentElement;
    expect(menu).toHaveClass('h-12', 'w-12');
    expect(mobileRow?.firstElementChild).toBe(menu);
    expect(mobileRow?.children[1]).toHaveAttribute('aria-label', 'MAJESTA EMBALAGENS — página inicial');
    const actionGroup = mobileRow?.children[2];
    if (!(actionGroup instanceof HTMLElement)) throw new Error('Mobile header actions are missing.');
    expect(within(actionGroup).getAllByRole('link')).toHaveLength(1);
    expect(within(actionGroup).getByRole('link', { name: 'Solicitar orçamento, 1 produto' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Falar com a Majesta pelo WhatsApp' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WhatsApp da Majesta Embalagens' })).toBeInTheDocument();
  });

  it('hides social promo links when their business URLs are not configured', () => {
    render(<Header />);
    expect(screen.queryByRole('link', { name: 'Instagram da Majesta Embalagens' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Facebook da Majesta Embalagens' })).not.toBeInTheDocument();
  });

  it('shows a centered compact homepage link and responsive full-width mobile search', () => {
    const { container } = render(<Header />);
    const brand = screen.getByRole('link', { name: 'MAJESTA EMBALAGENS — página inicial' });
    expect(brand).toHaveAttribute('href', '/');
    expect(brand).toHaveClass('justify-self-center', 'lg:justify-self-auto');
    expect(screen.getAllByRole('search')).toHaveLength(2);
    expect(screen.getAllByPlaceholderText('Pesquisar produtos...')).toHaveLength(2);
    expect(screen.getAllByRole('search')[0]).toHaveAttribute('action', '/produtos');
    expect(screen.getAllByRole('search')[0]).toHaveAttribute('method', 'get');
    expect(screen.getAllByRole('search')[0]?.querySelector('input')).toHaveAttribute('name', 'q');
    expect(container.querySelector('.h-14')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitar orçamento, 1 produto' })).toBeInTheDocument();
  });

  it('submits a header search to the product catalog with the trimmed query', () => {
    render(<Header />);
    const [mobileSearch] = screen.getAllByRole('search');
    fireEvent.change(within(mobileSearch!).getByRole('textbox', { name: 'Pesquisar produtos' }), {
      target: { value: '  CX-001  ' },
    });
    fireEvent.submit(mobileSearch!);

    expect(layoutMocks.navigate).toHaveBeenCalledWith({
      to: '/produtos',
      search: expect.any(Function),
    });
    expect(layoutMocks.navigate.mock.calls[0]![0].search({ categoria: 'caixas' })).toEqual({
      categoria: 'caixas',
      q: 'CX-001',
    });
  });

  it('shows configured contact details and useful links without categories or missing business data', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('heading', { name: 'MAJESTA EMBALAGENS' })).toBeInTheDocument();
    expect(within(footer!).getByRole('heading', { name: 'Contato' })).toBeInTheDocument();
    expect(within(footer!).getByRole('heading', { name: 'Links úteis' })).toBeInTheDocument();
    expect(within(footer!).getByRole('link', { name: /Telefone/ })).toHaveAttribute('href', 'tel:5519996145193');
    expect(within(footer!).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/5519996145193'));
    expect(within(footer!).getByRole('link', { name: 'Produtos' })).toHaveAttribute('href', '/produtos');
    expect(within(footer!).queryByText('Caixas')).not.toBeInTheDocument();
    expect(within(footer!).queryByText(/CNPJ|Razão social|Endereço/)).not.toBeInTheDocument();
    expect(within(footer!).queryByRole('link', { name: /Instagram|Facebook|@/ })).not.toBeInTheDocument();
  });

  it('centers footer identity, contact and useful links on mobile while retaining desktop alignment classes', () => {
    layoutMocks.catalog.config.instagram = 'https://instagram.com/majesta-oficial';
    layoutMocks.catalog.config.facebook = 'https://facebook.com/majesta-oficial';
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    const identity = within(footer).getByRole('heading', { name: 'MAJESTA EMBALAGENS' }).parentElement;
    const contact = within(footer).getByRole('heading', { name: 'Contato' }).parentElement;
    const usefulLinks = within(footer).getByRole('heading', { name: 'Links úteis' }).parentElement;

    expect(identity).toHaveClass('items-center', 'text-center', 'md:items-start', 'md:text-left');
    expect(contact).toHaveClass('items-center', 'text-center', 'md:items-start', 'md:text-left');
    expect(usefulLinks).toHaveClass('items-center', 'text-center', 'md:items-start', 'md:text-left');
    expect(footer.lastElementChild).toHaveClass('text-center');
    expect(within(footer).getByRole('link', { name: 'Instagram' })).toHaveClass(
      'justify-center',
      'md:justify-start',
    );
    expect(within(footer).getByRole('link', { name: 'Facebook' })).toHaveClass(
      'justify-center',
      'md:justify-start',
    );
  });

  it('renders the business email only when it is configured', () => {
    layoutMocks.catalog.config.email = 'comercial@example.com';
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;
    expect(within(footer).getByRole('link', { name: 'comercial@example.com' })).toHaveAttribute(
      'href',
      'mailto:comercial@example.com',
    );
  });

  it('shows official Instagram and Facebook URLs only when configured, opening them safely in new tabs', () => {
    layoutMocks.catalog.config.instagram = 'https://instagram.com/majesta-oficial';
    layoutMocks.catalog.config.facebook = 'https://facebook.com/majesta-oficial';
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer')!;

    const instagram = within(footer).getByRole('link', { name: 'Instagram' });
    expect(instagram).toHaveAttribute('href', 'https://instagram.com/majesta-oficial');
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
    expect(instagram.querySelector('svg')).toHaveClass('text-gold');

    const facebook = within(footer).getByRole('link', { name: 'Facebook' });
    expect(facebook).toHaveAttribute('href', 'https://facebook.com/majesta-oficial');
    expect(facebook).toHaveAttribute('target', '_blank');
    expect(facebook).toHaveAttribute('rel', 'noopener noreferrer');
    expect(facebook.querySelector('svg')).toHaveClass('text-gold');
  });

  it('adds products directly when there is no ambiguous variation and keeps details links clickable', () => {
    const products = [
      product('sem-variacoes', 'Descrição curta.'),
      product('com-variacoes-unicas', 'Produto com um modelo definido.', ['Grande']),
    ];
    const { container, rerender } = render(
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map(item => <ProductCard key={item.slug} p={item} />)}
      </div>,
    );

    const cards = container.querySelectorAll('article');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      const button = within(card).getByRole('button', { name: /Solicitar cotação de Produto/ });
      expect(button).toHaveClass('h-11', 'w-full', 'rounded-full');
      expect(card.querySelector('p')).toHaveClass('line-clamp-3', 'h-[4.5rem]', 'overflow-hidden');
    }
    const firstButton = within(cards[0]!).getByRole('button', { name: 'Solicitar cotação de Produto sem-variacoes' });
    fireEvent.click(firstButton);
    fireEvent.click(within(cards[1]!).getByRole('button', { name: 'Solicitar cotação de Produto com-variacoes-unicas' }));
    expect(layoutMocks.add).toHaveBeenNthCalledWith(1, products[0], undefined);
    expect(layoutMocks.add).toHaveBeenNthCalledWith(2, products[1], 'Grande');
    rerender(
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map(item => <ProductCard key={item.slug} p={item} />)}
      </div>,
    );
    const addedButton = within(container).getByRole('button', { name: 'Adicionado ao orçamento de Produto sem-variacoes' });
    expect(addedButton).toBeDisabled();
    expect(addedButton).toHaveClass('bg-gold');
    expect(within(container).queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(addedButton);
    expect(layoutMocks.add).toHaveBeenCalledTimes(2);
    expect(cards[0]?.querySelector('img')?.parentElement).toHaveClass('aspect-[5/4]');
    expect(within(cards[0]!).getAllByRole('link', { name: 'Produto sem-variacoes' }).every(
      (link) => link.getAttribute('href') === '/produtos/sem-variacoes',
    )).toBe(true);
    expect(container.querySelector('.grid')).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
  });

  it('requires a model choice for multiple variations and avoids duplicate quote lines', () => {
    const ambiguousProduct = product('variacoes', 'Produto com diversos modelos.', ['Pequeno', 'Grande']);
    const { container } = render(<ProductCard p={ambiguousProduct} />);
    expect(screen.getByRole('link', { name: 'Selecionar modelo' })).toHaveAttribute(
      'href',
      '/produtos/variacoes',
    );
    expect(layoutMocks.add).not.toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: 'Produto variacoes' }).every(
      (link) => link.getAttribute('href') === '/produtos/variacoes',
    )).toBe(true);

    cleanup();
    layoutMocks.add.mockClear();
    layoutMocks.items.push({ slug: 'existente', variation: 'Grande' });
    render(<ProductCard p={product('existente', 'Produto já selecionado.', ['Grande'])} />);
    const addedButton = screen.getByRole('button', { name: 'Adicionado ao orçamento de Produto existente' });
    expect(addedButton).toBeDisabled();
    expect(layoutMocks.add).not.toHaveBeenCalled();
    expect(screen.queryByText('Já está no orçamento')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('reserves the same three-line description space when the description is absent', () => {
    const { container } = render(<ProductCard p={product('vazio', '')} />);
    const description = container.querySelector('article > div > p');
    expect(description).toHaveTextContent('');
    expect(description).toHaveClass('h-[4.5rem]', 'line-clamp-3');
  });
});
