import { products as mockProducts } from "../data/mockProducts";
import type { Product, ProductInput } from "../types";

type ProductResponse = {
  product: Product;
};

type ProductListResponse = {
  products: Product[];
};

export async function fetchPublicProducts() {
  try {
    return await requestProductList("/api/products");
  } catch {
    return mockProducts.filter((product) => product.isVisible);
  }
}

export async function fetchAdminProducts() {
  return requestProductList("/api/admin/products");
}

export async function createProduct(input: ProductInput) {
  const response = await requestJson<ProductResponse>("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.product;
}

export async function updateProduct(id: string, input: ProductInput) {
  const response = await requestJson<ProductResponse>(`/api/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return response.product;
}

export async function setProductVisibility(id: string, isVisible: boolean) {
  const response = await requestJson<ProductResponse>(`/api/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ isVisible }),
  });

  return response.product;
}

async function requestProductList(url: string) {
  const response = await requestJson<ProductListResponse>(url);

  return response.products;
}

async function requestJson<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("API sản phẩm chưa chạy. Hãy dùng `npm run cf:dev`.");
  }

  const payload = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message || "Không thể xử lý dữ liệu sản phẩm.");
  }

  return payload;
}
