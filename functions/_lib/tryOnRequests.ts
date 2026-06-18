import { getProduct, type ProductsEnv } from "./products";

const MAX_TRY_ON_IMAGE_SIZE = 5 * 1024 * 1024;
const TRY_ON_REQUEST_TTL_HOURS = 24;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type TryOnEnv = ProductsEnv & {
  TRY_ON_IMAGES: R2Bucket;
};

type ContactChannel = "zalo" | "facebook" | "phone";

type TryOnStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

type TryOnRequestRow = {
  id: string;
  product_id: string;
  product_name: string | null;
  product_slug: string | null;
  customer_name: string | null;
  customer_phone: string;
  customer_contact_channel: ContactChannel;
  input_image_key: string | null;
  status: TryOnStatus;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  expires_at: string | null;
};

export type TryOnRequestsEnv = TryOnEnv;

export async function createTryOnRequest(env: TryOnRequestsEnv, formData: FormData) {
  const productId = cleanText(formData.get("productId"));
  const customerName = cleanText(formData.get("customerName")).slice(0, 120);
  const customerPhone = normalizePhone(cleanText(formData.get("customerPhone")));
  const customerContactChannel = normalizeContactChannel(
    cleanText(formData.get("customerContactChannel")),
  );
  const image = formData.get("image");

  if (!productId) {
    throw new TryOnRequestError("Thiếu sản phẩm cần thử.", 400);
  }

  if (!customerPhone) {
    throw new TryOnRequestError("Hãy nhập số điện thoại hoặc Zalo.", 400);
  }

  if (!customerContactChannel) {
    throw new TryOnRequestError("Kênh liên hệ không hợp lệ.", 400);
  }

  if (!(image instanceof File)) {
    throw new TryOnRequestError("Hãy chọn ảnh để shop tư vấn.", 400);
  }

  validateTryOnImage(image);

  const product = await getProduct(env.DB, productId);

  if (!product || !product.isVisible) {
    throw new TryOnRequestError("Không tìm thấy sản phẩm đang hiển thị.", 404);
  }

  if (product.stockStatus === "out_of_stock") {
    throw new TryOnRequestError("Mẫu này đang hết hàng, chưa nhận thử đồ.", 400);
  }

  const id = crypto.randomUUID();
  const extension = ALLOWED_IMAGE_TYPES.get(image.type);
  const objectKey = `try-on-requests/${id}/input.${extension}`;

  await env.TRY_ON_IMAGES.put(objectKey, image.stream(), {
    httpMetadata: {
      contentType: image.type,
      cacheControl: "private, max-age=0, no-store",
    },
    customMetadata: {
      originalName: image.name.slice(0, 180),
      productId,
      requestId: id,
    },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO try_on_requests (
        id, product_id, customer_name, customer_phone,
        customer_contact_channel, input_image_key, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now', ?))`,
    )
      .bind(
        id,
        productId,
        customerName || null,
        customerPhone,
        customerContactChannel,
        objectKey,
        `+${TRY_ON_REQUEST_TTL_HOURS} hours`,
      )
      .run();
  } catch (error) {
    await env.TRY_ON_IMAGES.delete(objectKey);
    throw error;
  }

  const request = await getTryOnRequest(env.DB, id);

  if (!request) {
    throw new TryOnRequestError("Không thể tạo yêu cầu thử đồ.", 500);
  }

  return request;
}

export async function listTryOnRequests(env: TryOnRequestsEnv) {
  const result = await env.DB.prepare(
    `SELECT
      request.*,
      product.name AS product_name,
      product.slug AS product_slug
    FROM try_on_requests request
    LEFT JOIN products product ON product.id = request.product_id
    ORDER BY request.created_at DESC
    LIMIT 100`,
  ).all<TryOnRequestRow>();

  return (result.results || []).map(mapTryOnRequest);
}

export async function getTryOnRequest(db: D1Database, id: string) {
  const row = await db
    .prepare(
      `SELECT
        request.*,
        product.name AS product_name,
        product.slug AS product_slug
      FROM try_on_requests request
      LEFT JOIN products product ON product.id = request.product_id
      WHERE request.id = ?
      LIMIT 1`,
    )
    .bind(id)
    .first<TryOnRequestRow>();

  return row ? mapTryOnRequest(row) : null;
}

export async function updateTryOnRequestStatus(
  env: TryOnRequestsEnv,
  id: string,
  status: unknown,
  adminNote: string,
) {
  if (!isTryOnStatus(status)) {
    throw new TryOnRequestError("Trạng thái thử đồ không hợp lệ.", 400);
  }

  const processedStatus = ["completed", "rejected", "failed"].includes(status);
  const result = await env.DB.prepare(
    `UPDATE try_on_requests
     SET status = ?,
         admin_note = ?,
         processed_at = CASE WHEN ? THEN datetime('now') ELSE processed_at END
     WHERE id = ?`,
  )
    .bind(status, cleanText(adminNote).slice(0, 500) || null, processedStatus ? 1 : 0, id)
    .run();

  if (!result.meta.changes) {
    return null;
  }

  return getTryOnRequest(env.DB, id);
}

export async function getTryOnRequestInputImage(
  env: TryOnRequestsEnv,
  requestId: string,
) {
  const request = await env.DB.prepare(
    "SELECT input_image_key FROM try_on_requests WHERE id = ? LIMIT 1",
  )
    .bind(requestId)
    .first<{ input_image_key: string | null }>();

  if (!request?.input_image_key) {
    return null;
  }

  const object = await env.TRY_ON_IMAGES.get(request.input_image_key);

  if (!object) {
    return null;
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=0, no-store");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
}

export class TryOnRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function mapTryOnRequest(row: TryOnRequestRow) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name || "Sản phẩm đã xóa",
    productSlug: row.product_slug || "",
    customerName: row.customer_name || "Khách chưa nhập tên",
    customerPhone: row.customer_phone,
    customerContactChannel: row.customer_contact_channel,
    inputImageUrl: row.input_image_key
      ? `/api/admin/try-on-requests/${row.id}/image`
      : "",
    status: row.status,
    adminNote: row.admin_note || "",
    createdAt: row.created_at,
    processedAt: row.processed_at || "",
    expiresAt: row.expires_at || "",
  };
}

function validateTryOnImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new TryOnRequestError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.", 400);
  }

  if (file.size === 0 || file.size > MAX_TRY_ON_IMAGE_SIZE) {
    throw new TryOnRequestError("Ảnh thử đồ phải nhỏ hơn hoặc bằng 5 MB.", 400);
  }
}

function normalizePhone(value: string) {
  const phone = value.replace(/\s+/g, "");

  if (!/^[+0-9().-]{7,24}$/.test(phone)) {
    return "";
  }

  return phone;
}

function normalizeContactChannel(value: string): ContactChannel | "" {
  if (value === "zalo" || value === "facebook" || value === "phone") {
    return value;
  }

  return "";
}

function isTryOnStatus(value: unknown): value is TryOnStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "processing" ||
    value === "completed" ||
    value === "rejected" ||
    value === "failed"
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
