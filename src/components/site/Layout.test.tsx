import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryDataSchema, productDataSchema, type CatalogData, type Product } from '@/data/catalog';
import { Footer, Header, ProductCard } from './Layout';

const layoutMocks = vi.hoisted(() => ({
  catalog: null as unknown as CatalogData,
  items: [] as unknown[],
  add: vi.fn(),
  has: vi.fn(() => false),
}));

vi.mock('@/lib/catalog-context', () => ({
  useCatalog: () => layoutMocks.catalog,
}));

vi.mock('@/lib/quote', () => ({
  useQuote: () => ({ items: layoutMocks.items, add: layoutMocks.add, has: layoutMocks.has }),
}));

vi.mock('@tanstack/react-router', () => ({
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
  layoutMocks.add.mockClear();
  layoutMocks.has.mockReset().mockReturnValue(false);
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
      'Categorias',
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
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const mobileNavigation = screen.getAllByRole('navigation')[1]!;
    const categoriesLink = within(mobileNavigation).getByRole('link', { name: 'Categorias' });
    expect(categoriesLink).toHaveAttribute('href', '/categorias');
    expect(within(mobileNavigation).queryByText('Soluções por Segmento')).not.toBeInTheDocument();
    expect(within(mobileNavigation).queryByRole('button', { name: 'Categorias' })).not.toBeInTheDocument();
    fireEvent.click(categoriesLink);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
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

  it('uses one details link button for products with or without variations without adding them to the quote', () => {
    const products = [
      product('sem-variacoes', 'Descrição curta.'),
      product('com-variacoes', 'Descrição maior para o produto com vários modelos disponíveis.', ['Pequeno', 'Grande']),
    ];
    const { container } = render(
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map(item => <ProductCard key={item.slug} p={item} />)}
      </div>,
    );

    const cards = container.querySelectorAll('article');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      const button = within(card).getByRole('link', { name: 'Solicitar cotação' });
      expect(button).toHaveAttribute('href', expect.stringMatching(/^\/produtos\/(sem-variacoes|com-variacoes)$/));
      expect(button).toHaveClass('h-11', 'w-full', 'rounded-full');
      expect(within(card).queryByText('Selecionar tamanho/modelo')).not.toBeInTheDocument();
      expect(within(card).getByText(/Descrição/)).toHaveClass('line-clamp-3', 'h-[4.5rem]', 'overflow-hidden');
    }
    expect(within(cards[0]!).getByRole('link', { name: 'Solicitar cotação' })).toHaveAttribute(
      'href',
      '/produtos/sem-variacoes',
    );
    expect(within(cards[1]!).getByRole('link', { name: 'Solicitar cotação' })).toHaveAttribute(
      'href',
      '/produtos/com-variacoes',
    );
    expect(layoutMocks.add).not.toHaveBeenCalled();
    expect(layoutMocks.items).toEqual([{ slug: 'caixa' }]);
    expect(cards[0]?.querySelector('img')?.parentElement).toHaveClass('aspect-[5/4]');
    expect(cards[0]?.querySelector('div > a:last-child')).toHaveClass('mt-auto');
    expect(container.querySelector('.grid')).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4');
  });

  it('reserves the same three-line description space when the description is absent', () => {
    const { container } = render(<ProductCard p={product('vazio', '')} />);
    const description = container.querySelector('article > div > p');
    expect(description).toHaveTextContent('');
    expect(description).toHaveClass('h-[4.5rem]', 'line-clamp-3');
  });
});
