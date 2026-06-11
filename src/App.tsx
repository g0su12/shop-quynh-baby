import { useMemo, useState } from "react";
import {
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Shirt,
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
import {
  ageOptions,
  categoryOptions,
  genderOptions,
  products,
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

function PublicCatalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [gender, setGender] = useState("Tất cả");
  const [age, setAge] = useState("Tất cả");

  const featuredProducts = products.filter((product) => product.isFeatured);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch) ||
        product.sizes.some((size) => size.toLowerCase().includes(normalizedSearch));

      const matchesCategory = category === "Tất cả" || product.category === category;
      const selectedGender = genderValue[gender];
      const matchesGender = selectedGender === "all" || product.gender === selectedGender;
      const matchesAge = age === "Tất cả" || product.ageGroup === age;

      return matchesSearch && matchesCategory && matchesGender && matchesAge;
    });
  }, [age, category, gender, search]);

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
    <fieldset className="filter-group">
      <legend>{label}</legend>
      <div className="chip-row">
        {options.map((option) => (
          <button
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
  return (
    <article className="product-card" data-compact={compact}>
      <div className="product-media">
        <img src={product.imageUrl} alt={product.name} />
        <span className="stock-badge" data-status={product.stockStatus}>
          {stockLabel[product.stockStatus]}
        </span>
      </div>
      <div className="product-content">
        <div className="product-title-row">
          <h3>{product.name}</h3>
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
          <a className="primary-button" href={zaloUrl} target="_blank" rel="noreferrer">
            <MessageCircle aria-hidden="true" />
            <span>Liên hệ</span>
          </a>
          <button className="secondary-button" type="button">
            <Shirt aria-hidden="true" />
            <span>Thử cho bé</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminPage />;
  }

  return <PublicCatalog />;
}

export default App;
