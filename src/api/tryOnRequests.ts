import type {
  ContactChannel,
  TryOnRequest,
  TryOnStatus,
} from "../types";

type TryOnRequestResponse = {
  request: TryOnRequest;
};

type TryOnRequestListResponse = {
  requests: TryOnRequest[];
};

type TryOnCleanupResponse = {
  deletedImageCount: number;
  expiredRequestCount: number;
};

export type CreateTryOnRequestInput = {
  productId: string;
  customerName: string;
  customerPhone: string;
  customerContactChannel: ContactChannel;
  imageFile: File;
  turnstileToken: string;
};

export async function createTryOnRequest(input: CreateTryOnRequestInput) {
  const formData = new FormData();
  formData.append("productId", input.productId);
  formData.append("customerName", input.customerName);
  formData.append("customerPhone", input.customerPhone);
  formData.append("customerContactChannel", input.customerContactChannel);
  formData.append("turnstileToken", input.turnstileToken);
  formData.append("image", input.imageFile);

  const response = await requestJson<TryOnRequestResponse>("/api/try-on-requests", {
    method: "POST",
    body: formData,
  });

  return response.request;
}

export async function cleanupExpiredTryOnRequests() {
  return requestJson<TryOnCleanupResponse>("/api/admin/try-on-requests/cleanup", {
    method: "POST",
  });
}

export async function fetchAdminTryOnRequests() {
  const response = await requestJson<TryOnRequestListResponse>(
    "/api/admin/try-on-requests",
  );

  return response.requests;
}

export async function updateAdminTryOnRequestStatus(
  id: string,
  status: TryOnStatus,
  adminNote?: string,
) {
  const payload =
    typeof adminNote === "string" ? { adminNote, status } : { status };
  const response = await requestJson<TryOnRequestResponse>(
    `/api/admin/try-on-requests/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  return response.request;
}

export async function generateAdminTryOnResultImage(id: string) {
  const response = await requestJson<TryOnRequestResponse>(
    `/api/admin/try-on-requests/${id}/generate`,
    {
      method: "POST",
    },
  );

  return response.request;
}

export async function uploadAdminTryOnResultImage(id: string, imageFile: File) {
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await requestJson<TryOnRequestResponse>(
    `/api/admin/try-on-requests/${id}/result-image`,
    {
      method: "POST",
      body: formData,
    },
  );

  return response.request;
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
    throw new Error("API thử đồ chưa chạy. Hãy dùng `npm run cf:dev`.");
  }

  const payload = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(payload.message || "Không thể xử lý yêu cầu thử đồ.");
  }

  return payload;
}
