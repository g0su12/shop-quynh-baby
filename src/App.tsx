import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  Phone,
  Search,
} from "lucide-react";
import {
  Baby,
  Basket,
  Dress,
  Pants,
  Sparkle,
  TShirt,
} from "@phosphor-icons/react";
import SiteSwitcher from "./components/SiteSwitcher";
import AdminPage from "./pages/AdminPage";
import { fetchPublicProductBySlug, fetchPublicProducts } from "./api/products";
import {
  ageOptions,
  categoryOptions,
  genderOptions,
  products as mockProducts,
} from "./data/mockProducts";
import type { Gender, Product, StockStatus } from "./types";

const shopName = import.meta.env.VITE_SHOP_NAME || "Quynh Baby Shop";
const shopPhone = import.meta.env.VITE_SHOP_PHONE || "0857036878";
const zaloUrl = import.meta.env.VITE_SHOP_ZALO_URL || `https://zalo.me/${shopPhone}`;
const facebookUrl =
  import.meta.env.VITE_SHOP_FACEBOOK_URL ||
  "https://www.facebook.com/nguyen.nhu.quynh.506701";
const mapsUrl =
  import.meta.env.VITE_SHOP_MAPS_URL || "https://maps.app.goo.gl/RebED1MNfFsy4BsG9";

const categoryHighlights = [
  {
    label: "Bộ đồ",
    description: "Set mặc hằng ngày",
    icon: Basket,
  },
  {
    label: "Váy",
    description: "Mẫu nhẹ nhàng",
    icon: Dress,
  },
  {
    label: "Áo",
    description: "Dễ phối size",
    icon: TShirt,
  },
  {
    label: "Quần",
    description: "Mềm, dễ vận động",
    icon: Pants,
  },
];

const genderLabel: Record<Gender, string> = {
  boy: "Bé trai",
  girl: "Bé gái",
  unisex: "Unisex",
};

const stockLabel: Record<StockStatus, string> = {
  in_stock: "Còn hàng",
  low_stock: "Sắp hết",
  out_of_stock: "Hết hàng",
};

const genderValue: Record<string, Gender | "all"> = {
  "Tất cả": "all",
  "Bé trai": "boy",
  "Bé gái": "girl",
  Unisex: "unisex",
};

const stockFilterOptions = ["Tất cả", "Còn hàng", "Sắp hết", "Hết hàng"];

const stockValue: Record<string, StockStatus | "all"> = {
  "Tất cả": "all",
  "Còn hàng": "in_stock",
  "Sắp hết": "low_stock",
  "Hết hàng": "out_of_stock",
};

function getProductUrl(product: Pick<Product, "slug">) {
  return `/products/${encodeURIComponent(product.slug)}`;
}

function getProductImages(product: Product) {
  const images = product.images
    .filter((image) => image.url)
    .sort((first, second) => {
      if (first.isPrimary !== second.isPrimary) {
        return first.isPrimary ? -1 : 1;
      }

      return first.sortOrder - second.sortOrder;
    });

  if (images.length > 0) {
    return images;
  }

  return [
    {
      id: `${product.id}-fallback`,
      url: product.imageUrl,
      altText: product.name,
      isPrimary: true,
      sortOrder: 0,
    },
  ];
}

function PublicCatalog() {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(mockProducts);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [gender, setGender] = useState("Tất cả");
  const [age, setAge] = useState("Tất cả");
  const [size, setSize] = useState("Tất cả");
  const [stock, setStock] = useState("Tất cả");

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      const nextProducts = await fetchPublicProducts();

      if (!ignore) {
        setCatalogProducts(nextProducts);
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, []);

  const featuredProducts = catalogProducts.filter((product) => product.isFeatured);

  const sizeOptions = useMemo(() => {
    const sizes = [
      ...new Set(catalogProducts.flatMap((product) => product.sizes)),
    ].sort((first, second) =>
      first.localeCompare(second, "vi", { numeric: true }),
    );

    return ["Tất cả", ...sizes];
  }, [catalogProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return catalogProducts.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch) ||
        product.sizes.some((size) => size.toLowerCase().includes(normalizedSearch));

      const matchesCategory = category === "Tất cả" || product.category === category;
      const selectedGender = genderValue[gender];
      const matchesGender = selectedGender === "all" || product.gender === selectedGender;
      const matchesAge = age === "Tất cả" || product.ageGroup === age;
      const matchesSize = size === "Tất cả" || product.sizes.includes(size);
      const selectedStock = stockValue[stock];
      const matchesStock =
        selectedStock === "all" || product.stockStatus === selectedStock;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesGender &&
        matchesAge &&
        matchesSize &&
        matchesStock
      );
    });
  }, [age, catalogProducts, category, gender, search, size, stock]);

  return (
    <main>
      <header className="site-header" aria-label="Điều hướng chính">
        <a className="brand" href="#top">
          <Baby aria-hidden="true" weight="duotone" />
          <span>{shopName}</span>
        </a>
        <div className="site-header-tools">
          <SiteSwitcher active="public" />
          <nav className="header-actions" aria-label="Liên hệ nhanh">
            <a className="icon-link" href={zaloUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              <span>Zalo</span>
            </a>
            <a className="icon-link" href={`tel:${shopPhone}`}>
              <Phone aria-hidden="true" />
              <span>Gọi</span>
            </a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <img src="/assets/mock-hero-catalog.png" alt="Quần áo trẻ em được xếp gọn" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow">Showroom quần áo trẻ em</p>
          <h1>{shopName}</h1>
          <p className="hero-copy">
            Mẫu đồ dễ mặc cho bé, còn size rõ ràng, tư vấn nhanh qua Zalo hoặc
            Facebook.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#catalog">
              <Search aria-hidden="true" />
              <span>Xem mẫu</span>
            </a>
            <a className="secondary-button" href={facebookUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              <span>Nhắn Facebook</span>
            </a>
          </div>
        </div>
      </section>

      <section className="quick-info" aria-label="Thông tin cửa hàng">
        <a href={mapsUrl} target="_blank" rel="noreferrer">
          <MapPin aria-hidden="true" />
          <span>Khu vực bán hàng</span>
        </a>
        <a href={zaloUrl} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden="true" />
          <span>Zalo {shopPhone}</span>
        </a>
        <a href={`tel:${shopPhone}`}>
          <Phone aria-hidden="true" />
          <span>{shopPhone}</span>
        </a>
      </section>

      <section className="category-ribbon" aria-label="Nhóm sản phẩm phổ biến">
        {categoryHighlights.map(({ description, icon: Icon, label }) => (
          <button
            className="category-tile"
            key={label}
            onClick={() => setCategory(label)}
            type="button"
          >
            <span className="category-icon">
              <Icon aria-hidden="true" weight="duotone" />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="section-band">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nổi bật</p>
            <h2>Mẫu đang được quan tâm</h2>
          </div>
          <a className="text-link" href="#catalog">
            Xem tất cả
          </a>
        </div>
        <div className="featured-grid">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>
      </section>

      <section className="catalog-section" id="catalog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2>Tìm mẫu phù hợp cho bé</h2>
          </div>
          <span className="result-count">{filteredProducts.length} mẫu</span>
        </div>

        <div className="filters" aria-label="Bộ lọc sản phẩm">
          <label className="search-box">
            <Search aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, size, danh mục"
              type="search"
            />
          </label>
          <FilterGroup label="Danh mục" options={categoryOptions} value={category} onChange={setCategory} />
          <FilterGroup label="Giới tính" options={genderOptions} value={gender} onChange={setGender} />
          <FilterGroup label="Độ tuổi" options={ageOptions} value={age} onChange={setAge} />
          <FilterGroup label="Size" options={sizeOptions} value={size} onChange={setSize} />
          <FilterGroup label="Tình trạng" options={stockFilterOptions} value={stock} onChange={setStock} />
        </div>

        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}

type FilterGroupProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <fieldset className="filter-group" data-count={options.length}>
      <legend>{label}</legend>
      <div className="chip-row">
        {options.map((option) => (
          <button
            aria-pressed={option === value}
            className="filter-chip"
            data-active={option === value}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type ProductCardProps = {
  product: Product;
  compact?: boolean;
};

function ProductCard({ product, compact = false }: ProductCardProps) {
  const detailUrl = getProductUrl(product);

  return (
    <article className="product-card" data-compact={compact}>
      <a className="product-media product-media-link" href={detailUrl}>
        <img src={product.imageUrl} alt={product.name} />
        <span className="stock-badge" data-status={product.stockStatus}>
          {stockLabel[product.stockStatus]}
        </span>
      </a>
      <div className="product-content">
        <div className="product-title-row">
          <h3>
            <a href={detailUrl}>{product.name}</a>
          </h3>
          {product.isFeatured ? <Sparkle aria-label="Sản phẩm nổi bật" weight="duotone" /> : null}
        </div>
        <p>{product.description}</p>
        <dl className="product-meta">
          <div>
            <dt>Nhóm</dt>
            <dd>{product.category}</dd>
          </div>
          <div>
            <dt>Cho</dt>
            <dd>{genderLabel[product.gender]}</dd>
          </div>
          <div>
            <dt>Tuổi</dt>
            <dd>{product.ageGroup}</dd>
          </div>
          <div>
            <dt>Cân nặng</dt>
            <dd>{product.weightRange}</dd>
          </div>
        </dl>
        <div className="size-row" aria-label="Size còn hàng">
          {product.sizes.map((size) => (
            <span key={size}>{size}</span>
          ))}
        </div>
        <div className="card-actions">
          <a className="primary-button" href={detailUrl}>
            <Search aria-hidden="true" />
            <span>Chi tiết</span>
          </a>
          <a className="secondary-button" href={zaloUrl} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" />
            <span>Liên hệ</span>
          </a>
        </div>
      </div>
    </article>
  );
}

type ProductDetailPageProps = {
  slug: string;
};

function ProductDetailPage({ slug }: ProductDetailPageProps) {
  const [product, setProduct] = useState<Product | null>();
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImageId, setSelectedImageId] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadProductDetail() {
      setProduct(undefined);
      setRelatedProducts([]);

      const [nextProduct, visibleProducts] = await Promise.all([
        fetchPublicProductBySlug(slug),
        fetchPublicProducts(),
      ]);

      if (ignore) {
        return;
      }

      setProduct(nextProduct);

      if (nextProduct) {
        setRelatedProducts(
          visibleProducts
            .filter(
              (item) =>
                item.id !== nextProduct.id &&
                (item.category === nextProduct.category ||
                  item.gender === nextProduct.gender),
            )
            .slice(0, 3),
        );
      }
    }

    void loadProductDetail();

    return () => {
      ignore = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!product) {
      return;
    }

    const previousTitle = document.title;
    const descriptionMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescription = descriptionMeta?.content;

    document.title = `${product.name} | ${shopName}`;
    descriptionMeta?.setAttribute(
      "content",
      `${product.name} - ${product.category}, ${product.ageGroup}, còn size ${product.sizes.join(", ")}.`,
    );

    return () => {
      document.title = previousTitle;

      if (descriptionMeta && previousDescription) {
        descriptionMeta.setAttribute("content", previousDescription);
      }
    };
  }, [product]);

  const images = useMemo(() => (product ? getProductImages(product) : []), [product]);
  const selectedImage = images.find((image) => image.id === selectedImageId) || images[0];

  useEffect(() => {
    if (images.length === 0) {
      setSelectedImageId("");
      return;
    }

    setSelectedImageId((current) =>
      images.some((image) => image.id === current) ? current : images[0].id,
    );
  }, [images]);

  return (
    <main>
      <header className="site-header" aria-label="Điều hướng chính">
        <a className="brand" href="/">
          <Baby aria-hidden="true" weight="duotone" />
          <span>{shopName}</span>
        </a>
        <div className="site-header-tools">
          <SiteSwitcher active="public" />
          <nav className="header-actions" aria-label="Liên hệ nhanh">
            <a className="icon-link" href={zaloUrl} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden="true" />
              <span>Zalo</span>
            </a>
            <a className="icon-link" href={`tel:${shopPhone}`}>
              <Phone aria-hidden="true" />
              <span>Gọi</span>
            </a>
          </nav>
        </div>
      </header>

      {product === undefined ? <ProductDetailLoading /> : null}
      {product === null ? <ProductDetailNotFound /> : null}

      {product && selectedImage ? (
        <>
          <section className="product-detail-page">
            <nav className="detail-breadcrumb" aria-label="Đường dẫn">
              <a href="/">Trang chủ</a>
              <ChevronRight aria-hidden="true" />
              <a href="/#catalog">Catalog</a>
              <ChevronRight aria-hidden="true" />
              <span>{product.name}</span>
            </nav>

            <div className="product-detail-layout">
              <div className="detail-gallery" aria-label={`Ảnh ${product.name}`}>
                <div className="detail-main-image">
                  <img src={selectedImage.url} alt={selectedImage.altText || product.name} />
                  <span className="stock-badge" data-status={product.stockStatus}>
                    {stockLabel[product.stockStatus]}
                  </span>
                </div>

                <div className="detail-thumbnails" aria-label="Chọn ảnh sản phẩm">
                  {images.map((image) => (
                    <button
                      aria-label={`Xem ảnh ${image.altText || product.name}`}
                      aria-pressed={image.id === selectedImage.id}
                      data-active={image.id === selectedImage.id}
                      key={image.id}
                      onClick={() => setSelectedImageId(image.id)}
                      type="button"
                    >
                      <img src={image.url} alt="" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-summary">
                <a className="text-link detail-back-link" href="/#catalog">
                  <ArrowLeft aria-hidden="true" />
                  <span>Về catalog</span>
                </a>

                <div>
                  <p className="eyebrow">{product.category}</p>
                  <h1>{product.name}</h1>
                </div>

                <p className="detail-description">
                  {product.description || "Mẫu đang có tại shop, vui lòng liên hệ để được tư vấn size phù hợp cho bé."}
                </p>

                <div className="detail-badges" aria-label="Thông tin nhanh">
                  <span>{genderLabel[product.gender]}</span>
                  {product.ageGroup ? <span>{product.ageGroup}</span> : null}
                  {product.weightRange ? <span>{product.weightRange}</span> : null}
                  {product.isFeatured ? <span>Mẫu nổi bật</span> : null}
                </div>

                <dl className="detail-info-grid">
                  <div>
                    <dt>Danh mục</dt>
                    <dd>{product.category}</dd>
                  </div>
                  <div>
                    <dt>Giới tính</dt>
                    <dd>{genderLabel[product.gender]}</dd>
                  </div>
                  <div>
                    <dt>Độ tuổi</dt>
                    <dd>{product.ageGroup || "Liên hệ shop"}</dd>
                  </div>
                  <div>
                    <dt>Cân nặng</dt>
                    <dd>{product.weightRange || "Liên hệ shop"}</dd>
                  </div>
                </dl>

                <div className="detail-section">
                  <h2>Size còn hàng</h2>
                  <div className="size-row">
                    {product.sizes.length > 0 ? (
                      product.sizes.map((size) => <span key={size}>{size}</span>)
                    ) : (
                      <span>Liên hệ shop</span>
                    )}
                  </div>
                </div>

                {product.colors.length > 0 ? (
                  <div className="detail-section">
                    <h2>Màu hiện có</h2>
                    <div className="color-row">
                      {product.colors.map((color) => (
                        <span key={color}>{color}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="detail-actions">
                  <a className="primary-button" href={zaloUrl} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" />
                    <span>Hỏi mẫu này</span>
                  </a>
                  <a className="secondary-button" href={facebookUrl} target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" />
                    <span>Facebook</span>
                  </a>
                  <a className="secondary-button" href={`tel:${shopPhone}`}>
                    <Phone aria-hidden="true" />
                    <span>Gọi shop</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="detail-panel-section">
            <div className="detail-panel">
              <div className="detail-panel-heading">
                <div>
                  <p className="eyebrow">Tình trạng</p>
                  <h2>Size và màu của mẫu</h2>
                </div>
                <span className="result-count">{product.variants.length} lựa chọn</span>
              </div>

              <div className="variant-availability-list">
                {product.variants.map((variant) => (
                  <div className="variant-availability-item" key={variant.id}>
                    <div>
                      <strong>Size {variant.sizeLabel}</strong>
                      <small>{variant.colorLabel || "Màu theo ảnh"}</small>
                    </div>
                    <span data-status={variant.stockStatus}>
                      {stockLabel[variant.stockStatus]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {relatedProducts.length > 0 ? (
            <section className="section-band detail-related">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Gợi ý</p>
                  <h2>Mẫu gần giống</h2>
                </div>
                <a className="text-link" href="/#catalog">
                  Xem catalog
                </a>
              </div>
              <div className="featured-grid">
                {relatedProducts.map((item) => (
                  <ProductCard compact key={item.id} product={item} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function ProductDetailLoading() {
  return (
    <section className="detail-state">
      <p className="eyebrow">Catalog</p>
      <h1>Đang tải mẫu</h1>
      <p>Đang lấy thông tin sản phẩm từ showroom.</p>
    </section>
  );
}

function ProductDetailNotFound() {
  return (
    <section className="detail-state">
      <a className="text-link detail-back-link" href="/#catalog">
        <ArrowLeft aria-hidden="true" />
        <span>Về catalog</span>
      </a>
      <p className="eyebrow">Catalog</p>
      <h1>Không tìm thấy mẫu này</h1>
      <p>Mẫu có thể đã được ẩn hoặc đường dẫn không còn đúng.</p>
    </section>
  );
}

function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  const productMatch = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);

  if (productMatch) {
    return <ProductDetailPage slug={decodeURIComponent(productMatch[1])} />;
  }

  return <PublicCatalog />;
}

export default App;
