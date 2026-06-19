import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ChevronRight,
  ImagePlus,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Send,
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
import { createTryOnRequest } from "./api/tryOnRequests";
import {
  categoryOptions,
  genderOptions,
  products as mockProducts,
} from "./data/mockProducts";
import type { ContactChannel, Gender, Product, StockStatus } from "./types";
import {
  formatFileSize,
  optimizeImageForUpload,
} from "./utils/optimizeImage";
import {
  catalogAgeYearsRange,
  catalogWeightKgRange,
  formatAgeYears,
  formatWeightKg,
  getProductAgeRange,
  getProductWeightRange,
  rangeIncludesValue,
} from "./utils/productRange";

const shopName = import.meta.env.VITE_SHOP_NAME || "Quynh Baby Shop";
const shopPhone = import.meta.env.VITE_SHOP_PHONE || "0857036878";
const zaloUrl = import.meta.env.VITE_SHOP_ZALO_URL || `https://zalo.me/${shopPhone}`;
const facebookUrl =
  import.meta.env.VITE_SHOP_FACEBOOK_URL ||
  "https://www.facebook.com/nguyen.nhu.quynh.506701";
const mapsUrl =
  import.meta.env.VITE_SHOP_MAPS_URL || "https://maps.app.goo.gl/RebED1MNfFsy4BsG9";
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          callback: (token: string) => void;
          "error-callback": () => void;
          sitekey: string;
          theme: "light";
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

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
  const [selectedAgeYears, setSelectedAgeYears] = useState<number | null>(null);
  const [selectedWeightKg, setSelectedWeightKg] = useState<number | null>(null);
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
    const normalizedSearch = normalizeCatalogSearch(search);

    return catalogProducts.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeCatalogSearch(product.name).includes(normalizedSearch);

      const matchesCategory = category === "Tất cả" || product.category === category;
      const selectedGender = genderValue[gender];
      const matchesGender = selectedGender === "all" || product.gender === selectedGender;
      const matchesAge =
        selectedAgeYears === null ||
        rangeIncludesValue(getProductAgeRange(product), selectedAgeYears * 12);
      const matchesWeight =
        selectedWeightKg === null ||
        rangeIncludesValue(getProductWeightRange(product), selectedWeightKg);
      const matchesSize = size === "Tất cả" || product.sizes.includes(size);
      const selectedStock = stockValue[stock];
      const matchesStock =
        selectedStock === "all" || product.stockStatus === selectedStock;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesGender &&
        matchesAge &&
        matchesWeight &&
        matchesSize &&
        matchesStock
      );
    });
  }, [
    catalogProducts,
    category,
    gender,
    search,
    selectedAgeYears,
    selectedWeightKg,
    size,
    stock,
  ]);

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
              placeholder="Tìm theo tên sản phẩm"
              type="search"
            />
          </label>
          <FilterGroup label="Danh mục" options={categoryOptions} value={category} onChange={setCategory} />
          <FilterGroup label="Giới tính" options={genderOptions} value={gender} onChange={setGender} />
          <RangeFilter
            label="Độ tuổi của bé"
            max={catalogAgeYearsRange.max}
            min={catalogAgeYearsRange.min}
            onChange={setSelectedAgeYears}
            step={1}
            value={selectedAgeYears}
            valueLabel={formatAgeYears}
          />
          <RangeFilter
            label="Cân nặng của bé"
            max={catalogWeightKgRange.max}
            min={catalogWeightKgRange.min}
            onChange={setSelectedWeightKg}
            step={1}
            value={selectedWeightKg}
            valueLabel={formatWeightKg}
          />
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

type RangeFilterProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number | null;
  valueLabel: (value: number) => string;
  onChange: (value: number | null) => void;
};

function RangeFilter({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueLabel,
}: RangeFilterProps) {
  const sliderValue = value ?? min;

  return (
    <fieldset className="range-filter">
      <legend>{label}</legend>
      <div className="range-filter-heading">
        <strong>{value === null ? "Tất cả" : valueLabel(value)}</strong>
        {value !== null ? (
          <button onClick={() => onChange(null)} type="button">
            Bỏ lọc
          </button>
        ) : null}
      </div>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={sliderValue}
      />
      <div className="range-filter-limits" aria-hidden="true">
        <span>{valueLabel(min)}</span>
        <span>{valueLabel(max)}</span>
      </div>
    </fieldset>
  );
}

function normalizeCatalogSearch(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
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
  const [tryOnCustomerName, setTryOnCustomerName] = useState("");
  const [tryOnCustomerPhone, setTryOnCustomerPhone] = useState("");
  const [tryOnContactChannel, setTryOnContactChannel] =
    useState<ContactChannel>("zalo");
  const [tryOnImage, setTryOnImage] = useState<File | null>(null);
  const [tryOnImageSummary, setTryOnImageSummary] = useState("");
  const [tryOnTurnstileToken, setTryOnTurnstileToken] = useState("");
  const [tryOnMessage, setTryOnMessage] = useState("");
  const [tryOnError, setTryOnError] = useState("");
  const [isPreparingTryOnImage, setIsPreparingTryOnImage] = useState(false);
  const [isSendingTryOnRequest, setIsSendingTryOnRequest] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef("");
  const tryOnImageInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) {
      return;
    }

    let isCancelled = false;

    function renderTurnstileWidget() {
      if (
        isCancelled ||
        !window.turnstile ||
        !turnstileContainerRef.current ||
        turnstileWidgetIdRef.current
      ) {
        return;
      }

      turnstileWidgetIdRef.current = window.turnstile.render(
        turnstileContainerRef.current,
        {
          sitekey: turnstileSiteKey,
          theme: "light",
          callback: setTryOnTurnstileToken,
          "error-callback": () => setTryOnTurnstileToken(""),
        },
      );
    }

    if (window.turnstile) {
      renderTurnstileWidget();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", renderTurnstileWidget, {
        once: true,
      });
      return () => {
        isCancelled = true;
        existingScript.removeEventListener("load", renderTurnstileWidget);
      };
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.addEventListener("load", renderTurnstileWidget, { once: true });
    document.head.appendChild(script);

    return () => {
      isCancelled = true;
      script.removeEventListener("load", renderTurnstileWidget);
    };
  }, [product?.id]);

  const canSubmitTryOnRequest = product?.stockStatus !== "out_of_stock";

  async function handleTryOnImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    setTryOnError("");
    setTryOnMessage("");

    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setTryOnError("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
      return;
    }

    setIsPreparingTryOnImage(true);

    try {
      const optimizedImage = await optimizeImageForUpload(file);
      setTryOnImage(optimizedImage.file);
      setTryOnImageSummary(
        optimizedImage.wasOptimized
          ? `${formatFileSize(optimizedImage.originalSize)} -> ${formatFileSize(
              optimizedImage.file.size,
            )}`
          : `${optimizedImage.file.name} · ${formatFileSize(optimizedImage.file.size)}`,
      );
    } catch (error) {
      setTryOnImage(null);
      setTryOnImageSummary("");
      setTryOnError(
        error instanceof Error ? error.message : "Không thể xử lý ảnh này.",
      );
    } finally {
      setIsPreparingTryOnImage(false);
    }
  }

  async function handleTryOnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product || !canSubmitTryOnRequest) {
      return;
    }

    setTryOnError("");
    setTryOnMessage("");

    if (!tryOnImage) {
      setTryOnError("Hãy chọn ảnh để shop tư vấn.");
      return;
    }

    if (turnstileSiteKey && !tryOnTurnstileToken) {
      setTryOnError("Vui lòng xác minh chống spam trước khi gửi.");
      return;
    }

    setIsSendingTryOnRequest(true);

    try {
      await createTryOnRequest({
        productId: product.id,
        customerName: tryOnCustomerName,
        customerPhone: tryOnCustomerPhone,
        customerContactChannel: tryOnContactChannel,
        imageFile: tryOnImage,
        turnstileToken: tryOnTurnstileToken,
      });
      setTryOnCustomerName("");
      setTryOnCustomerPhone("");
      setTryOnContactChannel("zalo");
      setTryOnImage(null);
      setTryOnImageSummary("");
      setTryOnTurnstileToken("");
      window.turnstile?.reset(turnstileWidgetIdRef.current);
      if (tryOnImageInputRef.current) {
        tryOnImageInputRef.current.value = "";
      }
      setTryOnMessage("Đã gửi yêu cầu. Shop sẽ liên hệ lại theo kênh bạn chọn.");
    } catch (error) {
      setTryOnError(
        error instanceof Error ? error.message : "Không thể gửi yêu cầu thử đồ.",
      );
    } finally {
      setIsSendingTryOnRequest(false);
    }
  }

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

          <section className="try-on-request-section">
            <div className="try-on-request-panel">
              <div className="detail-panel-heading">
                <div>
                  <p className="eyebrow">Try-on</p>
                  <h2>Gửi ảnh để shop tư vấn thử đồ</h2>
                </div>
                <span className="result-count">
                  {canSubmitTryOnRequest ? "Nhận yêu cầu" : "Đang hết hàng"}
                </span>
              </div>

              <form className="try-on-request-form" onSubmit={handleTryOnSubmit}>
                <div className="try-on-request-grid">
                  <label className="try-on-field">
                    <span>Tên khách</span>
                    <input
                      autoComplete="name"
                      maxLength={120}
                      onChange={(event) => setTryOnCustomerName(event.target.value)}
                      placeholder="Tên liên hệ"
                      value={tryOnCustomerName}
                    />
                  </label>
                  <label className="try-on-field">
                    <span>Số điện thoại/Zalo</span>
                    <input
                      autoComplete="tel"
                      maxLength={24}
                      onChange={(event) => setTryOnCustomerPhone(event.target.value)}
                      placeholder="Số để shop gọi lại"
                      required
                      value={tryOnCustomerPhone}
                    />
                  </label>
                  <label className="try-on-field">
                    <span>Kênh liên hệ</span>
                    <select
                      onChange={(event) =>
                        setTryOnContactChannel(event.target.value as ContactChannel)
                      }
                      value={tryOnContactChannel}
                    >
                      <option value="zalo">Zalo</option>
                      <option value="facebook">Facebook</option>
                      <option value="phone">Gọi điện</option>
                    </select>
                  </label>
                  <label className="try-on-upload">
                    <ImagePlus aria-hidden="true" />
                    <span>
                      {isPreparingTryOnImage
                        ? "Đang xử lý ảnh..."
                        : tryOnImageSummary || "Chọn ảnh"}
                    </span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      disabled={
                        !canSubmitTryOnRequest ||
                        isPreparingTryOnImage ||
                        isSendingTryOnRequest
                      }
                      onChange={handleTryOnImageChange}
                      ref={tryOnImageInputRef}
                      type="file"
                    />
                  </label>
                </div>

                <p className="try-on-privacy-note">
                  Ảnh chỉ dùng để shop tư vấn mẫu này và tự hết hạn sau 24 giờ.
                </p>

                {turnstileSiteKey ? (
                  <div
                    className="try-on-turnstile"
                    ref={turnstileContainerRef}
                  />
                ) : null}

                {tryOnError ? (
                  <p className="try-on-message" data-tone="error" role="alert">
                    {tryOnError}
                  </p>
                ) : null}
                {tryOnMessage ? (
                  <p className="try-on-message" data-tone="success" role="status">
                    {tryOnMessage}
                  </p>
                ) : null}

                <button
                  className="primary-button"
                  disabled={
                    !canSubmitTryOnRequest ||
                    isPreparingTryOnImage ||
                    isSendingTryOnRequest
                  }
                  type="submit"
                >
                  <Send aria-hidden="true" />
                  <span>
                    {isSendingTryOnRequest ? "Đang gửi..." : "Gửi yêu cầu"}
                  </span>
                </button>
              </form>
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
