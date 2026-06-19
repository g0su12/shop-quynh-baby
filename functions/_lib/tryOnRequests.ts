import { getProduct, type ProductsEnv } from "./products";

const MAX_TRY_ON_IMAGE_SIZE = 5 * 1024 * 1024;
const TRY_ON_REQUEST_TTL_HOURS = 24;
const DAILY_IP_REQUEST_LIMIT = 12;
const DAILY_PHONE_REQUEST_LIMIT = 4;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type TryOnEnv = ProductsEnv & {
  TRY_ON_IMAGES: R2Bucket;
  TURNSTILE_SECRET_KEY?: string;
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
  result_image_key: string | null;
  status: TryOnStatus;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  expires_at: string | null;
};

type ExpiredTryOnImageRow = {
  id: string;
  input_image_key: string | null;
  result_image_key: string | null;
};

export type TryOnRequestsEnv = TryOnEnv;

export async function createTryOnRequest(
  env: TryOnRequestsEnv,
  formData: FormData,
  request: Request,
) {
  const productId = cleanText(formData.get("productId"));
  const customerName = cleanText(formData.get("customerName")).slice(0, 120);
  const customerPhone = normalizePhone(cleanText(formData.get("customerPhone")));
  const customerContactChannel = normalizeContactChannel(
    cleanText(formData.get("customerContactChannel")),
  );
  const turnstileToken = cleanText(formData.get("turnstileToken"));
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
  await verifyTurnstileIfConfigured(env, turnstileToken, request);
  await enforceTryOnRateLimit(env.DB, request, customerPhone);

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

  const createdRequest = await getTryOnRequest(env.DB, id);

  if (!createdRequest) {
    throw new TryOnRequestError("Không thể tạo yêu cầu thử đồ.", 500);
  }

  return createdRequest;
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

export async function cleanupExpiredTryOnRequests(env: TryOnRequestsEnv) {
  const result = await env.DB.prepare(
    `SELECT id, input_image_key, result_image_key
     FROM try_on_requests
     WHERE expires_at IS NOT NULL
       AND expires_at <= datetime('now')
       AND (input_image_key IS NOT NULL OR result_image_key IS NOT NULL)
     LIMIT 100`,
  ).all<ExpiredTryOnImageRow>();
  const expiredRows = result.results || [];
  const imageKeys = [
    ...new Set(
      expiredRows.flatMap((row) =>
        [row.input_image_key, row.result_image_key].filter(
          (key): key is string => Boolean(key),
        ),
      ),
    ),
  ];

  if (imageKeys.length > 0) {
    await env.TRY_ON_IMAGES.delete(imageKeys);
  }

  const requestIds = expiredRows.map((row) => row.id);

  if (requestIds.length > 0) {
    await env.DB.prepare(
      `UPDATE try_on_requests
       SET input_image_key = NULL,
           result_image_key = NULL,
           admin_note = COALESCE(admin_note, 'Ảnh đã được tự động dọn sau khi hết hạn.')
       WHERE id IN (${requestIds.map(() => "?").join(", ")})`,
    )
      .bind(...requestIds)
      .run();
  }

  await env.DB.prepare(
    "DELETE FROM try_on_request_limits WHERE window_date < date('now', '-7 days')",
  ).run();

  return {
    deletedImageCount: imageKeys.length,
    expiredRequestCount: requestIds.length,
  };
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
  adminNote?: unknown,
) {
  if (!isTryOnStatus(status)) {
    throw new TryOnRequestError("Trạng thái thử đồ không hợp lệ.", 400);
  }

  const hasAdminNote = typeof adminNote === "string";
  const nextAdminNote = hasAdminNote
    ? cleanText(adminNote).slice(0, 500) || null
    : null;
  const processedStatus = ["completed", "rejected", "failed"].includes(status);
  const result = await env.DB.prepare(
    `UPDATE try_on_requests
     SET status = ?,
         admin_note = CASE WHEN ? THEN ? ELSE admin_note END,
         processed_at = CASE WHEN ? THEN datetime('now') ELSE processed_at END
     WHERE id = ?`,
  )
    .bind(status, hasAdminNote ? 1 : 0, nextAdminNote, processedStatus ? 1 : 0, id)
    .run();

  if (!result.meta.changes) {
    return null;
  }

  return getTryOnRequest(env.DB, id);
}

export async function uploadTryOnRequestResultImage(
  env: TryOnRequestsEnv,
  requestId: string,
  formData: FormData,
) {
  const image = formData.get("image");

  if (!(image instanceof File)) {
    throw new TryOnRequestError("Hãy chọn ảnh kết quả thử đồ.", 400);
  }

  validateTryOnImage(image);

  const existing = await env.DB.prepare(
    "SELECT result_image_key FROM try_on_requests WHERE id = ? LIMIT 1",
  )
    .bind(requestId)
    .first<{ result_image_key: string | null }>();

  if (!existing) {
    throw new TryOnRequestError("Không tìm thấy yêu cầu thử đồ.", 404);
  }

  const extension = ALLOWED_IMAGE_TYPES.get(image.type);
  const objectKey = `try-on-requests/${requestId}/result.${extension}`;

  await env.TRY_ON_IMAGES.put(objectKey, image.stream(), {
    httpMetadata: {
      contentType: image.type,
      cacheControl: "private, max-age=0, no-store",
    },
    customMetadata: {
      originalName: image.name.slice(0, 180),
      requestId,
      role: "result",
    },
  });

  try {
    const result = await env.DB.prepare(
      `UPDATE try_on_requests
       SET result_image_key = ?,
           status = 'completed',
           processed_at = datetime('now'),
           expires_at = datetime('now', ?)
       WHERE id = ?`,
    )
      .bind(objectKey, `+${TRY_ON_REQUEST_TTL_HOURS} hours`, requestId)
      .run();

    if (!result.meta.changes) {
      await env.TRY_ON_IMAGES.delete(objectKey);
      throw new TryOnRequestError("Không tìm thấy yêu cầu thử đồ.", 404);
    }
  } catch (error) {
    if (!(error instanceof TryOnRequestError)) {
      await env.TRY_ON_IMAGES.delete(objectKey);
    }
    throw error;
  }

  if (
    existing.result_image_key &&
    existing.result_image_key !== objectKey
  ) {
    await env.TRY_ON_IMAGES.delete(existing.result_image_key);
  }

  const updatedRequest = await getTryOnRequest(env.DB, requestId);

  if (!updatedRequest) {
    throw new TryOnRequestError("Không tìm thấy yêu cầu thử đồ.", 404);
  }

  return updatedRequest;
}

export async function getTryOnRequestInputImage(
  env: TryOnRequestsEnv,
  requestId: string,
) {
  return getTryOnRequestImage(env, requestId, "input");
}

export async function getTryOnRequestResultImage(
  env: TryOnRequestsEnv,
  requestId: string,
) {
  return getTryOnRequestImage(env, requestId, "result");
}

async function getTryOnRequestImage(
  env: TryOnRequestsEnv,
  requestId: string,
  imageKind: "input" | "result",
) {
  const keyColumn =
    imageKind === "input" ? "input_image_key" : "result_image_key";
  const request = await env.DB.prepare(
    `SELECT ${keyColumn} AS image_key FROM try_on_requests WHERE id = ? LIMIT 1`,
  )
    .bind(requestId)
    .first<{ image_key: string | null }>();

  if (!request?.image_key) {
    return null;
  }

  const object = await env.TRY_ON_IMAGES.get(request.image_key);

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
    resultImageUrl: row.result_image_key
      ? `/api/admin/try-on-requests/${row.id}/result-image`
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

async function verifyTurnstileIfConfigured(
  env: TryOnRequestsEnv,
  token: string,
  request: Request,
) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return;
  }

  if (!token) {
    throw new TryOnRequestError("Vui lòng xác minh chống spam.", 400);
  }

  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);

  const ipAddress = getClientIp(request);

  if (ipAddress) {
    body.append("remoteip", ipAddress);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
    },
  );
  const result = (await response.json()) as { success?: boolean };

  if (!result.success) {
    throw new TryOnRequestError("Xác minh chống spam không thành công.", 400);
  }
}

async function enforceTryOnRateLimit(
  db: D1Database,
  request: Request,
  customerPhone: string,
) {
  const ipAddress = getClientIp(request);
  const windowDate = new Date().toISOString().slice(0, 10);
  const keys = [
    ipAddress
      ? {
          id: `ip:${await sha256Hex(ipAddress)}`,
          limit: DAILY_IP_REQUEST_LIMIT,
          label: "thiết bị/mạng này",
        }
      : null,
    {
      id: `phone:${await sha256Hex(customerPhone)}`,
      limit: DAILY_PHONE_REQUEST_LIMIT,
      label: "số điện thoại này",
    },
  ].filter((key): key is { id: string; label: string; limit: number } =>
    Boolean(key),
  );

  for (const key of keys) {
    const existing = await db
      .prepare(
        "SELECT request_count FROM try_on_request_limits WHERE id = ? AND window_date = ? LIMIT 1",
      )
      .bind(key.id, windowDate)
      .first<{ request_count: number }>();

    if (Number(existing?.request_count || 0) >= key.limit) {
      throw new TryOnRequestError(
        `Hôm nay ${key.label} đã gửi quá nhiều yêu cầu thử đồ.`,
        429,
      );
    }
  }

  for (const key of keys) {
    await db
      .prepare(
        `INSERT INTO try_on_request_limits (id, request_count, window_date)
         VALUES (?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           request_count = CASE
             WHEN try_on_request_limits.window_date = excluded.window_date
               THEN try_on_request_limits.request_count + 1
             ELSE 1
           END,
           window_date = excluded.window_date,
           updated_at = datetime('now')`,
      )
      .bind(key.id, windowDate)
      .run();
  }
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
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
