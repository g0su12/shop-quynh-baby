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

export async function fetchPublicProductBySlug(slug: string) {
  try {
    const response = await requestJson<ProductResponse>(
      `/api/products/${encodeURIComponent(slug)}`,
    );

    return response.product;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    return (
      mockProducts.find((product) => product.isVisible && product.slug === slug) ||
      null
    );
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

export async function uploadProductImages(id: string, files: File[]) {
  const formData = new FormData();

  for (const file of files) {
    formData.append("images", file);
  }

  const response = await requestJson<ProductResponse>(
    `/api/admin/products/${id}/images`,
    {
      method: "POST",
      body: formData,
    },
  );

  return response.product;
}

export async function deleteProductImage(id: string) {
  const response = await requestJson<ProductResponse>(
    `/api/admin/product-images/${id}`,
    { method: "DELETE" },
  );

  return response.product;
}

export async function setPrimaryProductImage(id: string) {
  const response = await requestJson<ProductResponse>(
    `/api/admin/product-images/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ isPrimary: true }),
    },
  );

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
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("API sản phẩm chưa chạy. Hãy dùng `npm run cf:dev`.");
  }

  const payload = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new ApiError(
      payload.message || "Không thể xử lý dữ liệu sản phẩm.",
      response.status,
    );
  }

  return payload;
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
