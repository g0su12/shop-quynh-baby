import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  Check,
  Download,
  Eye,
  LogOut,
  LockKeyhole,
  Pencil,
  Plus,
  Upload,
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
import { products } from "../data/mockProducts";
import type { Product, StockStatus } from "../types";

type TryOnRequest = {
  id: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  channel: "Zalo" | "Facebook";
  createdAt: string;
  status: "pending" | "approved" | "completed";
};

const tryOnRequests: TryOnRequest[] = [
  {
    id: "try-001",
    productName: "Váy hoa nhẹ nhàng",
    customerName: "Chị Lan",
    customerPhone: "09xx xxx 128",
    channel: "Zalo",
    createdAt: "15 phút trước",
    status: "pending",
  },
  {
    id: "try-002",
    productName: "Set cotton pastel đi chơi",
    customerName: "Anh Minh",
    customerPhone: "09xx xxx 204",
    channel: "Facebook",
    createdAt: "1 giờ trước",
    status: "approved",
  },
];

const stockLabel: Record<StockStatus, string> = {
  in_stock: "Còn hàng",
  low_stock: "Sắp hết",
  out_of_stock: "Hết hàng",
};

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

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
  const visibleProducts = products.filter(
    (product) => product.stockStatus !== "out_of_stock",
  ).length;
  const lowStockProducts = products.filter(
    (product) => product.stockStatus === "low_stock",
  ).length;
  const featuredProducts = products.filter((product) => product.isFeatured).length;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="brand admin-brand" href="/">
          <Storefront aria-hidden="true" weight="duotone" />
          <span>Quynh Baby Admin</span>
        </a>
        <div className="admin-header-actions">
          <SiteSwitcher active="admin" />
          <button className="secondary-button" type="button">
            <Upload aria-hidden="true" />
            <span>Ảnh</span>
          </button>
          <button className="primary-button" type="button">
            <Plus aria-hidden="true" />
            <span>Sản phẩm</span>
          </button>
        </div>
      </header>

      <section className="admin-dashboard">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <a className="admin-nav-item" data-active="true" href="#overview">
            <ClipboardText aria-hidden="true" weight="duotone" />
            <span>Tổng quan</span>
          </a>
          <a className="admin-nav-item" href="#products">
            <Package aria-hidden="true" weight="duotone" />
            <span>Sản phẩm</span>
          </a>
          <a className="admin-nav-item" href="#try-on">
            <MagicWand aria-hidden="true" weight="duotone" />
            <span>Thử đồ</span>
          </a>
          <a className="admin-nav-item" href="#media">
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
                value={visibleProducts.toString()}
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
              <button className="primary-button" type="button">
                <Plus aria-hidden="true" />
                <span>Thêm mẫu</span>
              </button>
            </div>
            <div className="admin-product-list">
              {products.map((product) => (
                <AdminProductRow key={product.id} product={product} />
              ))}
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
            <div className="try-on-list">
              {tryOnRequests.map((request) => (
                <article className="try-on-row" key={request.id}>
                  <div className="try-on-avatar">
                    <MagicWand aria-hidden="true" weight="duotone" />
                  </div>
                  <div className="try-on-main">
                    <h3>{request.productName}</h3>
                    <p>
                      {request.customerName} · {request.customerPhone} · {request.channel}
                    </p>
                    <small>{request.createdAt}</small>
                  </div>
                  <div className="try-on-actions">
                    <button className="secondary-button" type="button">
                      <Eye aria-hidden="true" />
                      <span>Xem</span>
                    </button>
                    <button className="primary-button" type="button">
                      <Check aria-hidden="true" />
                      <span>Duyệt</span>
                    </button>
                    <button className="secondary-button" type="button">
                      <Download aria-hidden="true" />
                      <span>Tải</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-panel" id="media">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">Media</p>
                <h2>Ảnh sản phẩm</h2>
              </div>
              <button className="secondary-button" type="button">
                <Upload aria-hidden="true" />
                <span>Tải ảnh</span>
              </button>
            </div>
            <div className="admin-empty-state">
              <ImageSquare aria-hidden="true" weight="duotone" />
              <div>
                <h3>Kho ảnh sẽ được nối với R2 ở bước tiếp theo</h3>
                <p>
                  Tạm thời phần này là placeholder để navigation hoạt động đúng
                  và giữ layout quản trị nhất quán.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
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

function AdminProductRow({ product }: { product: Product }) {
  return (
    <article className="admin-product-row">
      <img src={product.imageUrl} alt={product.name} />
      <div className="admin-product-main">
        <div>
          <h3>{product.name}</h3>
          <p>
            {product.category} · {product.ageGroup} · {product.weightRange}
          </p>
        </div>
        <div className="admin-size-list">
          {product.sizes.map((size) => (
            <span key={size}>{size}</span>
          ))}
        </div>
      </div>
      <span className="admin-stock" data-status={product.stockStatus}>
        {stockLabel[product.stockStatus]}
      </span>
      <div className="admin-row-actions">
        <button className="secondary-button" type="button">
          <Pencil aria-hidden="true" />
          <span>Sửa</span>
        </button>
        <button className="secondary-button" type="button">
          <Archive aria-hidden="true" />
          <span>Ẩn</span>
        </button>
      </div>
    </article>
  );
}

export default AdminPage;
