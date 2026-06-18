import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  Archive,
  Check,
  Download,
  Eye,
  LogOut,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  Camera,
  ClipboardText,
  ImageSquare,
  MagicWand,
  Package,
  ShieldCheck,
  Storefront,
} from "@phosphor-icons/react";
import SiteSwitcher from "../components/SiteSwitcher";
import ProductFormModal from "../components/ProductFormModal";
import {
  createProduct,
  deleteProduct,
  deleteProductImage,
  fetchAdminProducts,
  setPrimaryProductImage,
  setProductVisibility,
  updateProduct,
  uploadProductImages,
} from "../api/products";
import {
  fetchAdminTryOnRequests,
  updateAdminTryOnRequestStatus,
} from "../api/tryOnRequests";
import { products as mockProducts } from "../data/mockProducts";
import type {
  ContactChannel,
  Product,
  ProductInput,
  StockStatus,
  TryOnRequest,
  TryOnStatus,
} from "../types";

const mockTryOnRequests: TryOnRequest[] = [
  {
    id: "try-001",
    productId: "p002",
    productName: "Váy hoa nhẹ nhàng",
    productSlug: "vay-hoa-nhe-nhang",
    customerName: "Chị Lan",
    customerPhone: "09xx xxx 128",
    customerContactChannel: "zalo",
    inputImageUrl: "",
    status: "pending",
    adminNote: "",
    createdAt: new Date().toISOString(),
    processedAt: "",
    expiresAt: "",
  },
  {
    id: "try-002",
    productId: "p001",
    productName: "Set cotton pastel đi chơi",
    productSlug: "set-cotton-pastel-di-choi",
    customerName: "Anh Minh",
    customerPhone: "09xx xxx 204",
    customerContactChannel: "facebook",
    inputImageUrl: "",
    status: "approved",
    adminNote: "",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    processedAt: "",
    expiresAt: "",
  },
];

const stockLabel: Record<StockStatus, string> = {
  in_stock: "Còn hàng",
  low_stock: "Sắp hết",
  out_of_stock: "Hết hàng",
};

const contactChannelLabel: Record<ContactChannel, string> = {
  zalo: "Zalo",
  facebook: "Facebook",
  phone: "Gọi điện",
};

const tryOnStatusLabel: Record<TryOnStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  rejected: "Từ chối",
  failed: "Lỗi",
};

const genderLabel: Record<Product["gender"], string> = {
  boy: "Bé trai",
  girl: "Bé gái",
  unisex: "Unisex",
};

const genderFilterOptions: Array<{
  label: string;
  value: Product["gender"] | "all";
}> = [
  { label: "Tất cả", value: "all" },
  { label: "Bé trai", value: "boy" },
  { label: "Bé gái", value: "girl" },
  { label: "Unisex", value: "unisex" },
];

const stockFilterOptions: Array<{ label: string; value: StockStatus | "all" }> = [
  { label: "Tất cả", value: "all" },
  { label: "Còn hàng", value: "in_stock" },
  { label: "Sắp hết", value: "low_stock" },
  { label: "Hết hàng", value: "out_of_stock" },
];

type ProductVisibilityFilter = "all" | "visible" | "hidden" | "featured";
type ProductSort = "default" | "name" | "stock" | "visibility" | "featured";
type MediaFilter = "all" | "primary" | "secondary" | "missing";
type MediaImage = Product["images"][number] & {
  product: Product;
};

const visibilityFilterOptions: Array<{
  label: string;
  value: ProductVisibilityFilter;
}> = [
  { label: "Tất cả", value: "all" },
  { label: "Đang hiển thị", value: "visible" },
  { label: "Đã ẩn", value: "hidden" },
  { label: "Nổi bật", value: "featured" },
];

const productSortOptions: Array<{ label: string; value: ProductSort }> = [
  { label: "Mặc định", value: "default" },
  { label: "Tên A-Z", value: "name" },
  { label: "Cần xử lý trước", value: "stock" },
  { label: "Đã ẩn trước", value: "visibility" },
  { label: "Nổi bật trước", value: "featured" },
];

const mediaFilterOptions: Array<{ label: string; value: MediaFilter }> = [
  { label: "Tất cả ảnh", value: "all" },
  { label: "Ảnh đại diện", value: "primary" },
  { label: "Ảnh phụ", value: "secondary" },
  { label: "Thiếu ảnh", value: "missing" },
];

const stockSortPriority: Record<StockStatus, number> = {
  low_stock: 0,
  out_of_stock: 1,
  in_stock: 2,
};

type AuthStatus = "checking" | "authenticated" | "unauthenticated";
type AdminSectionId = "overview" | "products" | "try-on" | "media";

const adminSectionIds: AdminSectionId[] = [
  "overview",
  "products",
  "try-on",
  "media",
];

function AdminPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (import.meta.env.DEV && localStorage.getItem("qbs_admin_dev_preview") === "true") {
      return "authenticated";
    }

    return "checking";
  });
  const isLoginRoute = window.location.pathname === "/admin/login";

  useEffect(() => {
    if (import.meta.env.DEV && localStorage.getItem("qbs_admin_dev_preview") === "true") {
      setAuthStatus("authenticated");
      return;
    }

    let ignore = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });
        const contentType = response.headers.get("content-type") || "";

        if (!response.ok || !contentType.includes("application/json")) {
          throw new Error("Session API is not available.");
        }

        const data = (await response.json()) as { authenticated?: boolean };

        if (!ignore) {
          setAuthStatus(data.authenticated ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (!ignore) {
          setAuthStatus("unauthenticated");
        }
      }
    }

    void checkSession();

    return () => {
      ignore = true;
    };
  }, []);

  if (authStatus === "checking") {
    return (
      <main className="admin-auth-shell">
        <section className="admin-auth-card" aria-live="polite">
          <span className="admin-auth-icon">
            <LockKeyhole aria-hidden="true" />
          </span>
          <p className="eyebrow">Admin</p>
          <h1>Đang kiểm tra đăng nhập</h1>
          <p>Vui lòng chờ trong giây lát.</p>
        </section>
      </main>
    );
  }

  if (isLoginRoute || authStatus !== "authenticated") {
    return <AdminLoginPage />;
  }

  return <AdminDashboard onLogout={() => void logoutAdmin()} />;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(mockProducts);
  const [catalogError, setCatalogError] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [tryOnRequests, setTryOnRequests] =
    useState<TryOnRequest[]>(mockTryOnRequests);
  const [tryOnError, setTryOnError] = useState("");
  const [isLoadingTryOnRequests, setIsLoadingTryOnRequests] = useState(true);
  const [tryOnActionId, setTryOnActionId] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState("");
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingCreatedProduct, setPendingCreatedProduct] =
    useState<Product | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("Tất cả");
  const [productGenderFilter, setProductGenderFilter] =
    useState<Product["gender"] | "all">("all");
  const [productStockFilter, setProductStockFilter] =
    useState<StockStatus | "all">("all");
  const [productVisibilityFilter, setProductVisibilityFilter] =
    useState<ProductVisibilityFilter>("all");
  const [productSort, setProductSort] = useState<ProductSort>("default");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [mediaActionId, setMediaActionId] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSectionId>(() =>
    getInitialAdminSection(),
  );
  const navigationLockRef = useRef<AdminSectionId | null>(null);
  const navigationLockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        const nextProducts = await fetchAdminProducts();

        if (!ignore) {
          setCatalogProducts(nextProducts);
          setCatalogError("");
        }
      } catch (error) {
        if (!ignore) {
          setCatalogError(
            error instanceof Error
              ? error.message
              : "Không thể tải dữ liệu sản phẩm từ D1.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadTryOnRequests() {
      try {
        const nextRequests = await fetchAdminTryOnRequests();

        if (!ignore) {
          setTryOnRequests(nextRequests);
          setTryOnError("");
        }
      } catch (error) {
        if (!ignore) {
          setTryOnError(
            error instanceof Error
              ? error.message
              : "Không thể tải yêu cầu thử đồ từ D1.",
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingTryOnRequests(false);
        }
      }
    }

    void loadTryOnRequests();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function updateActiveSection() {
      if (navigationLockRef.current) {
        setActiveSection(navigationLockRef.current);
        return;
      }

      const marker = window.scrollY + getAdminSectionMarkerOffset();
      let nextSection: AdminSectionId = "overview";

      for (const sectionId of adminSectionIds) {
        const section = document.getElementById(sectionId);

        if (section && section.offsetTop <= marker) {
          nextSection = sectionId;
        }
      }

      if (isAdminPageBottom()) {
        nextSection = adminSectionIds[adminSectionIds.length - 1];
      }

      setActiveSection(nextSection);
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);

      if (navigationLockTimerRef.current !== null) {
        window.clearTimeout(navigationLockTimerRef.current);
      }
    };
  }, []);

  const sellingProducts = catalogProducts.filter(
    (product) => product.isVisible && product.stockStatus !== "out_of_stock",
  ).length;
  const lowStockProducts = catalogProducts.filter(
    (product) => product.isVisible && product.stockStatus === "low_stock",
  ).length;
  const featuredProducts = catalogProducts.filter(
    (product) => product.isFeatured,
  ).length;
  const mediaImages = useMemo(
    () =>
      catalogProducts.flatMap((product) =>
        product.images.map((image) => ({
          ...image,
          product,
        })),
      ),
    [catalogProducts],
  );
  const productsMissingImages = useMemo(
    () => catalogProducts.filter((product) => product.images.length === 0),
    [catalogProducts],
  );
  const productCategoryOptions = useMemo(() => {
    const categories = [
      ...new Set(
        catalogProducts
          .map((product) => product.category)
          .filter((category) => category.trim()),
      ),
    ].sort((first, second) =>
      first.localeCompare(second, "vi", { numeric: true }),
    );

    return ["Tất cả", ...categories];
  }, [catalogProducts]);
  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(productSearch);

    return catalogProducts
      .map((product, index) => ({ index, product }))
      .filter(({ product }) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            product.name,
            product.description,
            product.category,
            product.ageGroup,
            product.weightRange,
            ...product.sizes,
            ...product.colors,
          ]
            .filter(Boolean)
            .some((value) =>
              normalizeSearchValue(value).includes(normalizedSearch),
            );
        const matchesCategory =
          productCategoryFilter === "Tất cả" ||
          product.category === productCategoryFilter;
        const matchesGender =
          productGenderFilter === "all" ||
          product.gender === productGenderFilter;
        const matchesStock =
          productStockFilter === "all" ||
          product.stockStatus === productStockFilter;
        const matchesVisibility = matchesProductVisibilityFilter(
          product,
          productVisibilityFilter,
        );

        return (
          matchesSearch &&
          matchesCategory &&
          matchesGender &&
          matchesStock &&
          matchesVisibility
        );
      })
      .sort(
        (first, second) =>
          compareAdminProducts(first.product, second.product, productSort) ||
          first.index - second.index,
      )
      .map(({ product }) => product);
  }, [
    catalogProducts,
    productCategoryFilter,
    productGenderFilter,
    productSearch,
    productSort,
    productStockFilter,
    productVisibilityFilter,
  ]);
  const hasActiveProductFilters =
    productSearch.trim() ||
    productCategoryFilter !== "Tất cả" ||
    productGenderFilter !== "all" ||
    productStockFilter !== "all" ||
    productVisibilityFilter !== "all" ||
    productSort !== "default";
  const normalizedMediaSearch = normalizeSearchValue(mediaSearch);
  const filteredMediaImages = useMemo(
    () =>
      mediaImages.filter((image) => {
        const matchesFilter =
          mediaFilter === "all" ||
          (mediaFilter === "primary" && image.isPrimary) ||
          (mediaFilter === "secondary" && !image.isPrimary);
        const matchesSearch =
          !normalizedMediaSearch ||
          [
            image.product.name,
            image.product.category,
            image.product.ageGroup,
            image.product.weightRange,
            image.altText,
          ]
            .filter(Boolean)
            .some((value) =>
              normalizeSearchValue(value).includes(normalizedMediaSearch),
            );

        return matchesFilter && matchesSearch;
      }),
    [mediaFilter, mediaImages, normalizedMediaSearch],
  );
  const filteredProductsMissingImages = useMemo(
    () =>
      productsMissingImages.filter((product) => {
        return (
          !normalizedMediaSearch ||
          [
            product.name,
            product.category,
            product.ageGroup,
            product.weightRange,
          ]
            .filter(Boolean)
            .some((value) =>
              normalizeSearchValue(value).includes(normalizedMediaSearch),
            )
        );
      }),
    [normalizedMediaSearch, productsMissingImages],
  );
  const hasActiveMediaFilters = mediaSearch.trim() || mediaFilter !== "all";

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="brand admin-brand" href="/">
          <Storefront aria-hidden="true" weight="duotone" />
          <span>Quynh Baby Admin</span>
        </a>
        <div className="admin-header-actions">
          <SiteSwitcher active="admin" />
          <button
            className="secondary-button"
            onClick={() => scrollToAdminSection("media")}
            type="button"
          >
            <Upload aria-hidden="true" />
            <span>Ảnh</span>
          </button>
          <button
            className="primary-button"
            onClick={() => openProductForm(null)}
            type="button"
          >
            <Plus aria-hidden="true" />
            <span>Sản phẩm</span>
          </button>
        </div>
      </header>

      <section className="admin-dashboard">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <a
            aria-current={activeSection === "overview" ? "location" : undefined}
            className="admin-nav-item"
            data-active={activeSection === "overview"}
            href="#overview"
            onClick={(event) => handleSectionNavigation(event, "overview")}
          >
            <ClipboardText aria-hidden="true" weight="duotone" />
            <span>Tổng quan</span>
          </a>
          <a
            aria-current={activeSection === "products" ? "location" : undefined}
            className="admin-nav-item"
            data-active={activeSection === "products"}
            href="#products"
            onClick={(event) => handleSectionNavigation(event, "products")}
          >
            <Package aria-hidden="true" weight="duotone" />
            <span>Sản phẩm</span>
          </a>
          <a
            aria-current={activeSection === "try-on" ? "location" : undefined}
            className="admin-nav-item"
            data-active={activeSection === "try-on"}
            href="#try-on"
            onClick={(event) => handleSectionNavigation(event, "try-on")}
          >
            <MagicWand aria-hidden="true" weight="duotone" />
            <span>Thử đồ</span>
          </a>
          <a
            aria-current={activeSection === "media" ? "location" : undefined}
            className="admin-nav-item"
            data-active={activeSection === "media"}
            href="#media"
            onClick={(event) => handleSectionNavigation(event, "media")}
          >
            <ImageSquare aria-hidden="true" weight="duotone" />
            <span>Ảnh</span>
          </a>
          <button className="admin-nav-item" onClick={onLogout} type="button">
            <LogOut aria-hidden="true" />
            <span>Thoát</span>
          </button>
        </aside>

        <div className="admin-content">
          <section className="admin-overview" id="overview">
            <div className="admin-title-block">
              <p className="eyebrow">Admin</p>
              <h1>Quản lý showroom</h1>
            </div>
            <div className="admin-stat-grid">
              <AdminStat
                icon={Package}
                label="Mẫu đang bán"
                value={sellingProducts.toString()}
              />
              <AdminStat
                icon={MagicWand}
                label="Yêu cầu thử đồ"
                value={tryOnRequests.length.toString()}
              />
              <AdminStat
                icon={ShieldCheck}
                label="Sản phẩm nổi bật"
                value={featuredProducts.toString()}
              />
              <AdminStat icon={Camera} label="Sắp hết" value={lowStockProducts.toString()} />
            </div>
          </section>

          <section className="admin-panel" id="products">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">Catalog</p>
                <h2>Sản phẩm</h2>
              </div>
              <button
                className="primary-button"
                onClick={() => openProductForm(null)}
                type="button"
              >
                <Plus aria-hidden="true" />
                <span>Thêm mẫu</span>
              </button>
            </div>
            {catalogError ? (
              <div className="admin-data-notice" role="status">
                <strong>Đang hiển thị dữ liệu mẫu.</strong>
                <span>{catalogError}</span>
              </div>
            ) : null}
            {isLoadingProducts ? (
              <div className="admin-data-notice" role="status">
                Đang tải sản phẩm từ D1...
              </div>
            ) : null}
            <div className="admin-product-toolbar" aria-label="Lọc sản phẩm">
              <label className="admin-product-search">
                <Search aria-hidden="true" />
                <input
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Tìm tên, size, màu, độ tuổi"
                  type="search"
                  value={productSearch}
                />
              </label>

              <div className="admin-product-filter-grid">
                <label className="admin-filter-field">
                  <span>Danh mục</span>
                  <select
                    onChange={(event) =>
                      setProductCategoryFilter(event.target.value)
                    }
                    value={productCategoryFilter}
                  >
                    {productCategoryOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="admin-filter-field">
                  <span>Dành cho</span>
                  <select
                    onChange={(event) =>
                      setProductGenderFilter(
                        event.target.value as Product["gender"] | "all",
                      )
                    }
                    value={productGenderFilter}
                  >
                    {genderFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-filter-field">
                  <span>Tồn hàng</span>
                  <select
                    onChange={(event) =>
                      setProductStockFilter(
                        event.target.value as StockStatus | "all",
                      )
                    }
                    value={productStockFilter}
                  >
                    {stockFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-filter-field">
                  <span>Hiển thị</span>
                  <select
                    onChange={(event) =>
                      setProductVisibilityFilter(
                        event.target.value as ProductVisibilityFilter,
                      )
                    }
                    value={productVisibilityFilter}
                  >
                    {visibilityFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-filter-field">
                  <span>Sắp xếp</span>
                  <select
                    onChange={(event) =>
                      setProductSort(event.target.value as ProductSort)
                    }
                    value={productSort}
                  >
                    {productSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-product-toolbar-footer">
                <span className="result-count">
                  {filteredProducts.length}/{catalogProducts.length} mẫu
                </span>
                {hasActiveProductFilters ? (
                  <button
                    className="secondary-button admin-clear-filters"
                    onClick={resetProductFilters}
                    type="button"
                  >
                    <X aria-hidden="true" />
                    <span>Xóa lọc</span>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="admin-product-list">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <AdminProductRow
                    key={product.id}
                    isDeleting={deletingProductId === product.id}
                    onDelete={() => void handleProductDelete(product)}
                    onEdit={() => openProductForm(product)}
                    onToggleVisibility={() => void handleVisibilityToggle(product)}
                    product={product}
                  />
                ))
              ) : (
                <div className="admin-empty-state">
                  <Package aria-hidden="true" weight="duotone" />
                  <div>
                    <h3>Không có sản phẩm phù hợp</h3>
                    <p>Đổi từ khóa hoặc bỏ bớt bộ lọc để xem lại catalog.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="admin-panel" id="try-on">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">Try-on</p>
                <h2>Yêu cầu thử cho bé</h2>
              </div>
              <span className="result-count">{tryOnRequests.length} yêu cầu</span>
            </div>
            {tryOnError ? (
              <div className="admin-data-notice" role="status">
                <strong>Đang hiển thị dữ liệu mẫu.</strong>
                <span>{tryOnError}</span>
              </div>
            ) : null}
            {isLoadingTryOnRequests ? (
              <div className="admin-data-notice" role="status">
                Đang tải yêu cầu thử đồ từ D1...
              </div>
            ) : null}
            <div className="try-on-list">
              {tryOnRequests.length > 0 ? (
                tryOnRequests.map((request) => (
                  <article className="try-on-row" key={request.id}>
                    <div className="try-on-avatar">
                      {request.inputImageUrl ? (
                        <img alt="" src={request.inputImageUrl} />
                      ) : (
                        <MagicWand aria-hidden="true" weight="duotone" />
                      )}
                    </div>
                    <div className="try-on-main">
                      <div className="try-on-title-row">
                        <h3>{request.productName}</h3>
                        <span
                          className="admin-product-tag"
                          data-tone={getTryOnStatusTone(request.status)}
                        >
                          {tryOnStatusLabel[request.status]}
                        </span>
                      </div>
                      <p>
                        {request.customerName} · {request.customerPhone} ·{" "}
                        {contactChannelLabel[request.customerContactChannel]}
                      </p>
                      <small>
                        {formatAdminDate(request.createdAt)}
                        {request.expiresAt
                          ? ` · Hết hạn ${formatAdminDate(request.expiresAt)}`
                          : ""}
                      </small>
                    </div>
                    <div className="try-on-actions">
                      {request.inputImageUrl ? (
                        <>
                          <a
                            className="secondary-button"
                            href={request.inputImageUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <Eye aria-hidden="true" />
                            <span>Xem</span>
                          </a>
                          <a
                            className="secondary-button"
                            download
                            href={request.inputImageUrl}
                          >
                            <Download aria-hidden="true" />
                            <span>Tải</span>
                          </a>
                        </>
                      ) : (
                        <button className="secondary-button" disabled type="button">
                          <Eye aria-hidden="true" />
                          <span>Xem</span>
                        </button>
                      )}
                      <button
                        className="primary-button"
                        disabled={
                          request.status !== "pending" ||
                          tryOnActionId === request.id
                        }
                        onClick={() => void handleTryOnApprove(request)}
                        type="button"
                      >
                        <Check aria-hidden="true" />
                        <span>
                          {tryOnActionId === request.id ? "Đang duyệt" : "Duyệt"}
                        </span>
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <AdminEmptyState
                  icon={MagicWand}
                  title="Chưa có yêu cầu thử đồ"
                  description="Yêu cầu mới sẽ xuất hiện ở đây sau khi khách gửi ảnh từ trang sản phẩm."
                />
              )}
            </div>
          </section>

          <section className="admin-panel" id="media">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">Media</p>
                <h2>Ảnh sản phẩm</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => scrollToAdminSection("products")}
                type="button"
              >
                <Upload aria-hidden="true" />
                <span>Chọn sản phẩm</span>
              </button>
            </div>

            <div className="admin-media-summary">
              <AdminStat
                icon={ImageSquare}
                label="Ảnh đã tải"
                value={mediaImages.length.toString()}
              />
              <AdminStat
                icon={ShieldCheck}
                label="Ảnh đại diện"
                value={mediaImages
                  .filter((image) => image.isPrimary)
                  .length.toString()}
              />
              <AdminStat
                icon={Camera}
                label="Thiếu ảnh"
                value={productsMissingImages.length.toString()}
              />
            </div>

            <div className="admin-product-toolbar" aria-label="Lọc ảnh sản phẩm">
              <label className="admin-product-search">
                <Search aria-hidden="true" />
                <input
                  onChange={(event) => setMediaSearch(event.target.value)}
                  placeholder="Tìm ảnh theo tên sản phẩm, danh mục"
                  type="search"
                  value={mediaSearch}
                />
              </label>

              <div className="admin-media-filter-row">
                {mediaFilterOptions.map((option) => (
                  <button
                    aria-pressed={mediaFilter === option.value}
                    className="filter-chip"
                    data-active={mediaFilter === option.value}
                    key={option.value}
                    onClick={() => setMediaFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="admin-product-toolbar-footer">
                <span className="result-count">
                  {mediaFilter === "missing"
                    ? `${filteredProductsMissingImages.length}/${productsMissingImages.length} mẫu thiếu ảnh`
                    : `${filteredMediaImages.length}/${mediaImages.length} ảnh`}
                </span>
                {hasActiveMediaFilters ? (
                  <button
                    className="secondary-button admin-clear-filters"
                    onClick={resetMediaFilters}
                    type="button"
                  >
                    <X aria-hidden="true" />
                    <span>Xóa lọc</span>
                  </button>
                ) : null}
              </div>
            </div>

            {mediaFilter === "missing" ? (
              <div className="admin-missing-media-list">
                {filteredProductsMissingImages.length > 0 ? (
                  filteredProductsMissingImages.map((product) => (
                    <article className="admin-missing-media-row" key={product.id}>
                      <span className="admin-missing-media-icon">
                        <ImageSquare aria-hidden="true" weight="duotone" />
                      </span>
                      <div>
                        <h3>{product.name}</h3>
                        <p>
                          {product.category} · {genderLabel[product.gender]} ·{" "}
                          {product.ageGroup || "Chưa nhập tuổi"}
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() => openProductForm(product)}
                        type="button"
                      >
                        <Upload aria-hidden="true" />
                        <span>Tải ảnh</span>
                      </button>
                    </article>
                  ))
                ) : (
                  <AdminEmptyState
                    icon={ShieldCheck}
                    title="Không có sản phẩm thiếu ảnh"
                    description="Tất cả sản phẩm trong bộ lọc hiện tại đã có ảnh."
                  />
                )}
              </div>
            ) : filteredMediaImages.length > 0 ? (
              <div className="admin-media-grid">
                {filteredMediaImages.map((image) => (
                  <AdminMediaCard
                    image={image}
                    isBusy={mediaActionId === image.id}
                    key={image.id}
                    onDelete={() => void handleMediaImageDelete(image)}
                    onEditProduct={() => openProductForm(image.product)}
                    onSetPrimary={() => void handleMediaSetPrimaryImage(image)}
                  />
                ))}
              </div>
            ) : (
              <AdminEmptyState
                icon={ImageSquare}
                title="Chưa có ảnh phù hợp"
                description={
                  mediaImages.length === 0
                    ? "Ảnh sẽ xuất hiện ở đây sau khi bạn tải ảnh trong form sản phẩm."
                    : "Đổi từ khóa hoặc bộ lọc để xem lại kho ảnh."
                }
              />
            )}
          </section>
        </div>
      </section>
      {isProductFormOpen ? (
        <ProductFormModal
          isSaving={isSavingProduct}
          onClose={closeProductForm}
          onDeleteImage={handleDeleteProductImage}
          onSave={handleProductSave}
          onSetPrimaryImage={handleSetPrimaryProductImage}
          product={editingProduct}
        />
      ) : null}
    </main>
  );

  function openProductForm(product: Product | null) {
    setEditingProduct(product);
    setPendingCreatedProduct(null);
    setIsProductFormOpen(true);
    setCatalogError("");
  }

  function handleSectionNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: AdminSectionId,
  ) {
    event.preventDefault();
    scrollToAdminSection(sectionId);
  }

  function scrollToAdminSection(sectionId: AdminSectionId) {
    const section = document.getElementById(sectionId);

    if (!section) {
      return;
    }

    navigationLockRef.current = sectionId;
    setActiveSection(sectionId);
    window.history.replaceState(null, "", `#${sectionId}`);

    if (navigationLockTimerRef.current !== null) {
      window.clearTimeout(navigationLockTimerRef.current);
    }

    navigationLockTimerRef.current = window.setTimeout(() => {
      navigationLockRef.current = null;
      navigationLockTimerRef.current = null;
    }, 250);

    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const targetScroll = Math.min(
      maxScroll,
      Math.max(0, section.offsetTop - getAdminNavigationOffset()),
    );
    const previousScrollBehavior =
      document.documentElement.style.scrollBehavior;

    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, targetScroll);
    document.documentElement.style.scrollBehavior = previousScrollBehavior;
  }

  function closeProductForm() {
    setIsProductFormOpen(false);
    setEditingProduct(null);
    setPendingCreatedProduct(null);
  }

  function resetProductFilters() {
    setProductSearch("");
    setProductCategoryFilter("Tất cả");
    setProductGenderFilter("all");
    setProductStockFilter("all");
    setProductVisibilityFilter("all");
    setProductSort("default");
  }

  function resetMediaFilters() {
    setMediaSearch("");
    setMediaFilter("all");
  }

  async function handleProductSave(input: ProductInput, imageFiles: File[]) {
    setIsSavingProduct(true);
    setCatalogError("");

    try {
      const activeProduct = editingProduct || pendingCreatedProduct;
      let savedProduct = activeProduct
        ? await updateProduct(activeProduct.id, input)
        : await createProduct(input);

      if (!activeProduct) {
        setPendingCreatedProduct(savedProduct);
      }
      upsertCatalogProduct(savedProduct);

      if (imageFiles.length > 0) {
        savedProduct = await uploadProductImages(savedProduct.id, imageFiles);
        upsertCatalogProduct(savedProduct);
      }

      closeProductForm();
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Không thể lưu sản phẩm.",
      );
      throw error;
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleDeleteProductImage(imageId: string) {
    const updatedProduct = await deleteProductImage(imageId);
    upsertCatalogProduct(updatedProduct);

    return updatedProduct;
  }

  async function handleSetPrimaryProductImage(imageId: string) {
    const updatedProduct = await setPrimaryProductImage(imageId);
    upsertCatalogProduct(updatedProduct);

    return updatedProduct;
  }

  async function handleMediaImageDelete(image: MediaImage) {
    const confirmed = window.confirm(
      `Xóa ảnh này khỏi "${image.product.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setCatalogError("");
    setMediaActionId(image.id);

    try {
      await handleDeleteProductImage(image.id);
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Không thể xóa ảnh.",
      );
    } finally {
      setMediaActionId("");
    }
  }

  async function handleMediaSetPrimaryImage(image: MediaImage) {
    setCatalogError("");
    setMediaActionId(image.id);

    try {
      await handleSetPrimaryProductImage(image.id);
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Không thể chọn ảnh đại diện.",
      );
    } finally {
      setMediaActionId("");
    }
  }

  async function handleTryOnApprove(request: TryOnRequest) {
    setTryOnError("");
    setTryOnActionId(request.id);

    try {
      const updatedRequest = await updateAdminTryOnRequestStatus(
        request.id,
        "approved",
      );
      setTryOnRequests((current) =>
        current.map((item) =>
          item.id === updatedRequest.id ? updatedRequest : item,
        ),
      );
    } catch (error) {
      setTryOnError(
        error instanceof Error
          ? error.message
          : "Không thể duyệt yêu cầu thử đồ.",
      );
    } finally {
      setTryOnActionId("");
    }
  }

  function upsertCatalogProduct(updatedProduct: Product) {
    setCatalogProducts((current) => {
      const productExists = current.some(
        (product) => product.id === updatedProduct.id,
      );

      return productExists
        ? current.map((product) =>
            product.id === updatedProduct.id ? updatedProduct : product,
          )
        : [updatedProduct, ...current];
    });
  }

  async function handleVisibilityToggle(product: Product) {
    setCatalogError("");

    try {
      const updatedProduct = await setProductVisibility(
        product.id,
        !product.isVisible,
      );
      setCatalogProducts((current) =>
        current.map((item) =>
          item.id === updatedProduct.id ? updatedProduct : item,
        ),
      );
    } catch (error) {
      setCatalogError(
        error instanceof Error
          ? error.message
          : "Không thể thay đổi trạng thái hiển thị.",
      );
    }
  }

  async function handleProductDelete(product: Product) {
    const confirmed = window.confirm(
      `Xóa "${product.name}" khỏi catalog? Ảnh đã upload của sản phẩm này cũng sẽ bị xóa.`,
    );

    if (!confirmed) {
      return;
    }

    setCatalogError("");
    setDeletingProductId(product.id);

    try {
      await deleteProduct(product.id);
      setCatalogProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Không thể xóa sản phẩm.",
      );
    } finally {
      setDeletingProductId("");
    }
  }
}

function getInitialAdminSection(): AdminSectionId {
  const sectionId = window.location.hash.slice(1);

  return adminSectionIds.includes(sectionId as AdminSectionId)
    ? (sectionId as AdminSectionId)
    : "overview";
}

function getAdminNavigationOffset() {
  return window.innerWidth <= 980 ? 76 : 96;
}

function getAdminSectionMarkerOffset() {
  return window.innerWidth <= 980 ? 96 : 120;
}

function isAdminPageBottom() {
  return (
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 4
  );
}

function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? ((await response.json()) as { message?: string })
        : {};

      if (!response.ok) {
        setError(
          data.message ||
            "Không đăng nhập được. Kiểm tra lại mật khẩu hoặc cấu hình admin.",
        );
        return;
      }

      const next = new URLSearchParams(window.location.search).get("next") || "/admin";
      window.location.assign(next);
    } catch {
      setError(
        "Auth API chưa chạy trong Vite dev server. Dùng `npm run cf:dev` để test cookie thật.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function enterDevPreview() {
    localStorage.setItem("qbs_admin_dev_preview", "true");
    window.location.assign("/admin");
  }

  return (
    <main className="admin-auth-shell">
      <form className="admin-auth-card" onSubmit={handleSubmit}>
        <span className="admin-auth-icon">
          <LockKeyhole aria-hidden="true" />
        </span>
        <p className="eyebrow">Admin</p>
        <h1>Đăng nhập quản lý</h1>
        <p>
          Shop chỉ có một admin, nên mình dùng mật khẩu cấu hình sẵn thay vì tạo
          luồng đăng ký tài khoản.
        </p>
        <label className="admin-auth-field">
          <span>Mật khẩu admin</span>
          <input
            autoComplete="current-password"
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="admin-auth-error">{error}</p> : null}
        <div className="admin-auth-actions">
          <button className="primary-button" disabled={isSubmitting} type="submit">
            <LockKeyhole aria-hidden="true" />
            <span>{isSubmitting ? "Đang vào..." : "Đăng nhập"}</span>
          </button>
          <a className="secondary-button" href="/">
            Về website
          </a>
        </div>
        {import.meta.env.DEV ? (
          <button className="admin-dev-link" onClick={enterDevPreview} type="button">
            Xem trước admin UI trong Vite dev
          </button>
        ) : null}
      </form>
    </main>
  );
}

async function logoutAdmin() {
  if (import.meta.env.DEV && localStorage.getItem("qbs_admin_dev_preview") === "true") {
    localStorage.removeItem("qbs_admin_dev_preview");
    window.location.assign("/admin/login");
    return;
  }

  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    window.location.assign("/admin/login");
  }
}

type AdminStatProps = {
  icon: typeof Package;
  label: string;
  value: string;
};

function AdminStat({ icon: Icon, label, value }: AdminStatProps) {
  return (
    <article className="admin-stat">
      <span>
        <Icon aria-hidden="true" weight="duotone" />
      </span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

type AdminEmptyStateProps = {
  icon: typeof Package;
  title: string;
  description: string;
};

function AdminEmptyState({
  description,
  icon: Icon,
  title,
}: AdminEmptyStateProps) {
  return (
    <div className="admin-empty-state">
      <Icon aria-hidden="true" weight="duotone" />
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

type AdminMediaCardProps = {
  image: MediaImage;
  isBusy: boolean;
  onDelete: () => void;
  onEditProduct: () => void;
  onSetPrimary: () => void;
};

function AdminMediaCard({
  image,
  isBusy,
  onDelete,
  onEditProduct,
  onSetPrimary,
}: AdminMediaCardProps) {
  const productUrl = `/products/${encodeURIComponent(image.product.slug)}`;

  return (
    <article className="admin-media-card">
      <div className="admin-media-preview">
        <img alt={image.altText || image.product.name} src={image.url} />
        {image.isPrimary ? (
          <span className="admin-media-primary-badge">
            <ShieldCheck aria-hidden="true" weight="duotone" />
            Đại diện
          </span>
        ) : null}
      </div>

      <div className="admin-media-card-body">
        <div>
          <h3>{image.product.name}</h3>
          <p>
            {image.product.category} · {genderLabel[image.product.gender]} ·{" "}
            {image.product.ageGroup || "Chưa nhập tuổi"}
          </p>
        </div>
        <div className="admin-media-card-actions">
          {image.product.isVisible ? (
            <a
              className="secondary-button"
              href={productUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Eye aria-hidden="true" />
              <span>Xem</span>
            </a>
          ) : null}
          <button className="secondary-button" onClick={onEditProduct} type="button">
            <Pencil aria-hidden="true" />
            <span>Sửa</span>
          </button>
          {!image.isPrimary ? (
            <button
              className="secondary-button"
              disabled={isBusy}
              onClick={onSetPrimary}
              type="button"
            >
              <ShieldCheck aria-hidden="true" />
              <span>Đại diện</span>
            </button>
          ) : null}
          <button
            className="secondary-button danger-button"
            disabled={isBusy}
            onClick={onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" />
            <span>{isBusy ? "Đang xóa" : "Xóa"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

type AdminProductRowProps = {
  product: Product;
  isDeleting: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
};

function AdminProductRow({
  isDeleting,
  onDelete,
  product,
  onEdit,
  onToggleVisibility,
}: AdminProductRowProps) {
  const productUrl = `/products/${encodeURIComponent(product.slug)}`;
  const managementStatus = getProductManagementStatus(product);

  return (
    <article className="admin-product-row" data-hidden={!product.isVisible}>
      <img src={product.imageUrl} alt={product.name} />
      <div className="admin-product-main">
        <div>
          <h3>{product.name}</h3>
          <p>
            {product.category} · {genderLabel[product.gender]} ·{" "}
            {product.ageGroup || "Chưa nhập tuổi"} ·{" "}
            {product.weightRange || "Chưa nhập cân nặng"}
          </p>
        </div>
        <div className="admin-size-list">
          {product.sizes.map((size) => (
            <span key={size}>{size}</span>
          ))}
        </div>
      </div>
      <div className="admin-status-list">
        <span className="admin-stock" data-status={product.stockStatus}>
          {stockLabel[product.stockStatus]}
        </span>
        <div className="admin-product-tags" aria-label="Trạng thái quản trị">
          <span
            className="admin-product-tag"
            data-tone={managementStatus.tone}
          >
            {managementStatus.label}
          </span>
          {product.isFeatured ? (
            <span className="admin-product-tag" data-tone="featured">
              Nổi bật
            </span>
          ) : null}
        </div>
      </div>
      <div className="admin-row-actions">
        {product.isVisible ? (
          <a
            className="secondary-button"
            href={productUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Eye aria-hidden="true" />
            <span>Xem</span>
          </a>
        ) : (
          <button
            className="secondary-button"
            disabled
            title="Sản phẩm đang ẩn trên website"
            type="button"
          >
            <Eye aria-hidden="true" />
            <span>Xem</span>
          </button>
        )}
        <button className="secondary-button" onClick={onEdit} type="button">
          <Pencil aria-hidden="true" />
          <span>Sửa</span>
        </button>
        <button
          className="secondary-button"
          onClick={onToggleVisibility}
          type="button"
        >
          <Archive aria-hidden="true" />
          <span>{product.isVisible ? "Ẩn" : "Hiện"}</span>
        </button>
        <button
          className="secondary-button danger-button"
          disabled={isDeleting}
          onClick={onDelete}
          type="button"
        >
          <Trash2 aria-hidden="true" />
          <span>{isDeleting ? "Đang xóa" : "Xóa"}</span>
        </button>
      </div>
    </article>
  );
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getProductManagementStatus(product: Product) {
  if (!product.isVisible) {
    return { label: "Đã ẩn", tone: "muted" };
  }

  if (product.stockStatus === "out_of_stock") {
    return { label: "Hết hàng", tone: "danger" };
  }

  return { label: "Đang bán", tone: "success" };
}

function getTryOnStatusTone(status: TryOnStatus) {
  switch (status) {
    case "approved":
    case "completed":
      return "success";
    case "rejected":
    case "failed":
      return "danger";
    case "processing":
      return "featured";
    default:
      return "muted";
  }
}

function formatAdminDate(value: string) {
  if (!value) {
    return "";
  }

  const normalizedValue = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function matchesProductVisibilityFilter(
  product: Product,
  filter: ProductVisibilityFilter,
) {
  switch (filter) {
    case "visible":
      return product.isVisible;
    case "hidden":
      return !product.isVisible;
    case "featured":
      return product.isFeatured;
    default:
      return true;
  }
}

function compareAdminProducts(
  first: Product,
  second: Product,
  sort: ProductSort,
) {
  switch (sort) {
    case "name":
      return compareText(first.name, second.name);
    case "stock":
      return (
        stockSortPriority[first.stockStatus] -
          stockSortPriority[second.stockStatus] || compareText(first.name, second.name)
      );
    case "visibility":
      return Number(first.isVisible) - Number(second.isVisible);
    case "featured":
      return Number(second.isFeatured) - Number(first.isFeatured);
    default:
      return 0;
  }
}

function compareText(first: string, second: string) {
  return first.localeCompare(second, "vi", { numeric: true });
}

export default AdminPage;
