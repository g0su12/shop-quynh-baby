import { getProduct, type ProductsEnv } from "./products";

const MAX_TRY_ON_IMAGE_SIZE = 5 * 1024 * 1024;
const TRY_ON_REQUEST_TTL_HOURS = 24;
const DAILY_IP_REQUEST_LIMIT = 12;
const DAILY_PHONE_REQUEST_LIMIT = 4;
const DEFAULT_TRY_ON_AI_PROVIDER = "cloudflare-pruna";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1";
const DEFAULT_OPENAI_IMAGE_SIZE = "1024x1024";
const DEFAULT_OPENAI_IMAGE_QUALITY = "low";
const DEFAULT_OPENAI_IMAGE_OUTPUT_FORMAT = "jpeg";
const DEFAULT_OPENAI_IMAGE_OUTPUT_COMPRESSION = "85";
const OPENAI_IMAGE_RETRY_COUNT = 1;
const CLOUDFLARE_PRUNA_MODEL = "pruna/p-image-try-on";
const DEFAULT_CLOUDFLARE_PRUNA_OUTPUT_FORMAT = "jpg";
const DEFAULT_CLOUDFLARE_PRUNA_OUTPUT_QUALITY = "90";
const DEFAULT_CLOUDFLARE_PRUNA_PRESERVE_INPUT_SIZE = "true";
const DEFAULT_CLOUDFLARE_PRUNA_TURBO = "false";
const DEFAULT_CLOUDFLARE_AI_GATEWAY_ID = "default";
const CLOUDFLARE_PRUNA_RETRY_COUNT = 1;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

type CloudflareAiBinding = {
  run: (
    model: string,
    input: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

type TryOnEnv = ProductsEnv & {
  AI?: CloudflareAiBinding;
  PRODUCT_IMAGES: R2Bucket;
  TRY_ON_IMAGES: R2Bucket;
  TRY_ON_AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_IMAGE_SIZE?: string;
  OPENAI_IMAGE_QUALITY?: string;
  OPENAI_IMAGE_OUTPUT_FORMAT?: string;
  OPENAI_IMAGE_OUTPUT_COMPRESSION?: string;
  CLOUDFLARE_PRUNA_OUTPUT_FORMAT?: string;
  CLOUDFLARE_PRUNA_OUTPUT_QUALITY?: string;
  CLOUDFLARE_PRUNA_PRESERVE_INPUT_SIZE?: string;
  CLOUDFLARE_PRUNA_TURBO?: string;
  CLOUDFLARE_AI_GATEWAY_ID?: string;
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

type TryOnGenerationRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_category: string;
  product_age_group: string | null;
  product_weight_range: string | null;
  input_image_key: string | null;
  result_image_key: string | null;
  admin_note: string | null;
};

type ProductImageReferenceRow = {
  object_key: string;
};

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
  };
};

type CloudflarePrunaTryOnResponse = {
  state?: string;
  result?: {
    image?: string;
  };
  image?: string;
  errors?: Array<{
    message?: string;
  }>;
  error?: {
    message?: string;
  } | string;
  success?: boolean;
};

type TryOnImageFile = File & {
  size: number;
};

type GeneratedTryOnImage = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  format: string;
  model: string;
  provider: TryOnAiProvider;
};

type TryOnAiProvider = "cloudflare-pruna" | "openai";

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

export async function generateTryOnRequestResultImage(
  env: TryOnRequestsEnv,
  requestId: string,
) {
  const provider = getTryOnAiProvider(env);

  if (provider === "openai" && !env.OPENAI_API_KEY) {
    throw new TryOnRequestError(
      "Chưa cấu hình OPENAI_API_KEY cho Worker.",
      400,
    );
  }

  if (provider === "cloudflare-pruna" && !env.AI) {
    throw new TryOnRequestError(
      "Chưa cấu hình Workers AI binding AI cho Worker.",
      400,
    );
  }

  const request = await getTryOnGenerationRow(env.DB, requestId);

  if (!request) {
    throw new TryOnRequestError("Không tìm thấy yêu cầu thử đồ.", 404);
  }

  if (!request.input_image_key) {
    throw new TryOnRequestError(
      "Yêu cầu này không còn ảnh khách để tạo AI.",
      400,
    );
  }

  const productImageKey = await getPrimaryProductImageKey(
    env.DB,
    request.product_id,
  );

  if (!productImageKey) {
    throw new TryOnRequestError(
      "Sản phẩm chưa có ảnh tham chiếu để tạo AI.",
      400,
    );
  }

  const processingNote = resetAiGenerationNote(request.admin_note);
  const finalNoteBase = removeAiGenerationProgressNote(processingNote);

  await setTryOnRequestProcessing(env.DB, requestId, processingNote);

  try {
    const [customerImage, productImage] = await Promise.all([
      getR2ImageFile(
        env.TRY_ON_IMAGES,
        request.input_image_key,
        "customer-reference",
      ),
      getR2ImageFile(env.PRODUCT_IMAGES, productImageKey, "product-reference"),
    ]);
    const prompt = buildTryOnPrompt(request);
    const generatedImage =
      provider === "cloudflare-pruna"
        ? await requestCloudflarePrunaTryOnWithRetry(
            env,
            requestId,
            prompt,
            customerImage,
            productImage,
          )
        : await requestOpenAIImageEditWithRetry(
            env,
            requestId,
            prompt,
            customerImage,
            productImage,
          );
    const objectKey =
      `try-on-requests/${requestId}/result-ai-${Date.now()}.` +
      generatedImage.extension;

    await env.TRY_ON_IMAGES.put(objectKey, generatedImage.bytes, {
      httpMetadata: {
        contentType: generatedImage.contentType,
        cacheControl: "private, max-age=0, no-store",
      },
      customMetadata: {
        productId: request.product_id,
        requestId,
        role: "ai-result",
        provider: generatedImage.provider,
        model: generatedImage.model,
        outputFormat: generatedImage.format,
      },
    });

    const nextNote = appendAdminNote(
      finalNoteBase,
      `AI đã tạo ảnh kết quả bằng ${generatedImage.model}.`,
    );
    const result = await env.DB.prepare(
      `UPDATE try_on_requests
       SET result_image_key = ?,
           status = 'completed',
           admin_note = ?,
           processed_at = datetime('now'),
           expires_at = datetime('now', ?)
       WHERE id = ?`,
    )
      .bind(objectKey, nextNote, `+${TRY_ON_REQUEST_TTL_HOURS} hours`, requestId)
      .run();

    if (!result.meta.changes) {
      await env.TRY_ON_IMAGES.delete(objectKey);
      throw new TryOnRequestError("Không tìm thấy yêu cầu thử đồ.", 404);
    }

    if (
      request.result_image_key &&
      request.result_image_key !== objectKey
    ) {
      await env.TRY_ON_IMAGES.delete(request.result_image_key);
    }

    const updatedRequest = await getTryOnRequest(env.DB, requestId);

    if (!updatedRequest) {
      throw new TryOnRequestError("Không tìm thấy yêu cầu thử đồ.", 404);
    }

    return updatedRequest;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể tạo ảnh AI.";
    await markTryOnRequestFailed(
      env.DB,
      requestId,
      appendAdminNote(finalNoteBase, `AI lỗi: ${message}`),
    );

    if (error instanceof TryOnRequestError) {
      throw error;
    }

    if (error instanceof OpenAIImageEditError) {
      throw new TryOnRequestError(message, error.status);
    }

    if (error instanceof CloudflarePrunaTryOnError) {
      throw new TryOnRequestError(message, error.status);
    }

    throw new TryOnRequestError(message, 502);
  }
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

async function getTryOnGenerationRow(db: D1Database, requestId: string) {
  return db
    .prepare(
      `SELECT
        request.id,
        request.product_id,
        request.input_image_key,
        request.result_image_key,
        request.admin_note,
        product.name AS product_name,
        product.description AS product_description,
        product.category AS product_category,
        product.age_group AS product_age_group,
        product.weight_range AS product_weight_range
       FROM try_on_requests request
       INNER JOIN products product ON product.id = request.product_id
       WHERE request.id = ?
       LIMIT 1`,
    )
    .bind(requestId)
    .first<TryOnGenerationRow>();
}

async function getPrimaryProductImageKey(db: D1Database, productId: string) {
  const image = await db
    .prepare(
      `SELECT object_key
       FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, sort_order, created_at
       LIMIT 1`,
    )
    .bind(productId)
    .first<ProductImageReferenceRow>();

  return image?.object_key || "";
}

async function setTryOnRequestProcessing(
  db: D1Database,
  requestId: string,
  adminNote: string,
) {
  await db
    .prepare(
      `UPDATE try_on_requests
       SET status = 'processing',
           admin_note = ?,
           processed_at = NULL
       WHERE id = ?`,
    )
    .bind(adminNote, requestId)
    .run();
}

async function markTryOnRequestFailed(
  db: D1Database,
  requestId: string,
  adminNote: string,
) {
  await db
    .prepare(
      `UPDATE try_on_requests
       SET status = 'failed',
           admin_note = ?,
           processed_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(adminNote, requestId)
    .run();
}

async function getR2ImageFile(
  bucket: R2Bucket,
  objectKey: string,
  filenamePrefix: string,
) {
  const object = await bucket.get(objectKey);

  if (!object) {
    throw new TryOnRequestError("Không tìm thấy ảnh tham chiếu.", 404);
  }

  const contentType =
    object.httpMetadata?.contentType || inferImageContentType(objectKey);
  const extension = ALLOWED_IMAGE_TYPES.get(contentType) || "png";
  const arrayBuffer = await object.arrayBuffer();

  return new File([arrayBuffer], `${filenamePrefix}.${extension}`, {
    type: contentType,
  });
}

async function requestCloudflarePrunaTryOn(
  env: TryOnRequestsEnv,
  requestId: string,
  attempt: number,
  prompt: string,
  customerImage: TryOnImageFile,
  productImage: TryOnImageFile,
): Promise<GeneratedTryOnImage> {
  const startedAt = Date.now();
  const outputFormat = getCloudflarePrunaOutputFormat(env);
  const outputQuality = getCloudflarePrunaOutputQuality(env);
  const gatewayId = getCloudflareAiGatewayId(env);
  const preserveInputSize = getCloudflarePrunaBoolean(
    env.CLOUDFLARE_PRUNA_PRESERVE_INPUT_SIZE,
    DEFAULT_CLOUDFLARE_PRUNA_PRESERVE_INPUT_SIZE,
  );
  const turbo = getCloudflarePrunaBoolean(
    env.CLOUDFLARE_PRUNA_TURBO,
    DEFAULT_CLOUDFLARE_PRUNA_TURBO,
  );

  try {
    if (!env.AI) {
      throw new CloudflarePrunaTryOnError(
        "Chưa cấu hình Workers AI binding AI cho Worker.",
        400,
      );
    }

    const [personImageDataUri, garmentImageDataUri] = await Promise.all([
      toImageDataUri(customerImage),
      toImageDataUri(productImage),
    ]);
    const payload = (await env.AI.run(CLOUDFLARE_PRUNA_MODEL, {
      person_image: personImageDataUri,
      garment_images: [garmentImageDataUri],
      output_format: outputFormat,
      output_quality: outputQuality,
      preserve_input_size: preserveInputSize,
      prompt,
      turbo,
    }, {
      gateway: {
        id: gatewayId,
        collectLog: true,
        metadata: {
          requestId,
          provider: "cloudflare-pruna",
        },
      },
    })) as CloudflarePrunaTryOnResponse;
    const errorMessage = getCloudflarePrunaErrorMessage(payload);

    console.info(
      "[try-on-ai]",
      JSON.stringify({
        event: "cloudflare_pruna_try_on_response",
        requestId,
        attempt,
        state: payload.state,
        success: payload.success,
        durationMs: Date.now() - startedAt,
        model: CLOUDFLARE_PRUNA_MODEL,
        gatewayId,
        outputFormat,
        outputQuality,
        preserveInputSize,
        turbo,
        customerImageBytes: customerImage.size,
        productImageBytes: productImage.size,
        errorMessage,
      }),
    );

    if (errorMessage) {
      throw new CloudflarePrunaTryOnError(errorMessage, 502);
    }

    if (payload.state && payload.state.toLowerCase() !== "completed") {
      throw new CloudflarePrunaTryOnError(
        `Cloudflare Pruna chưa hoàn tất xử lý: ${payload.state}.`,
        502,
      );
    }

    const imageUrl = payload.result?.image || payload.image || "";

    if (!imageUrl) {
      throw new CloudflarePrunaTryOnError(
        "Cloudflare Pruna không trả về URL ảnh kết quả.",
        502,
      );
    }

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new CloudflarePrunaTryOnError(
        `Không tải được ảnh kết quả Pruna (${imageResponse.status}).`,
        imageResponse.status,
      );
    }

    const contentType = normalizeGeneratedImageContentType(
      imageResponse.headers.get("content-type") || "",
      outputFormat,
    );
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());

    if (bytes.byteLength === 0) {
      throw new CloudflarePrunaTryOnError(
        "Cloudflare Pruna trả về ảnh kết quả rỗng.",
        502,
      );
    }

    return {
      bytes,
      contentType,
      extension: getGeneratedImageExtension(outputFormat),
      format: outputFormat,
      model: CLOUDFLARE_PRUNA_MODEL,
      provider: "cloudflare-pruna",
    };
  } catch (error) {
    const normalizedError = normalizeCloudflarePrunaTryOnError(error, gatewayId);

    console.warn(
      "[try-on-ai]",
      JSON.stringify({
        event: "cloudflare_pruna_try_on_error",
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        model: CLOUDFLARE_PRUNA_MODEL,
        gatewayId,
        outputFormat,
        outputQuality,
        preserveInputSize,
        turbo,
        customerImageBytes: customerImage.size,
        productImageBytes: productImage.size,
        errorName:
          normalizedError instanceof Error
            ? normalizedError.name
            : "UnknownError",
        errorMessage:
          normalizedError instanceof Error
            ? normalizedError.message
            : "Unknown Cloudflare Pruna error",
        cloudflareStatus:
          normalizedError instanceof CloudflarePrunaTryOnError
            ? normalizedError.status
            : undefined,
      }),
    );
    throw normalizedError;
  }
}

async function requestCloudflarePrunaTryOnWithRetry(
  env: TryOnRequestsEnv,
  requestId: string,
  prompt: string,
  customerImage: TryOnImageFile,
  productImage: TryOnImageFile,
): Promise<GeneratedTryOnImage> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= CLOUDFLARE_PRUNA_RETRY_COUNT; attempt += 1) {
    try {
      return await requestCloudflarePrunaTryOn(
        env,
        requestId,
        attempt + 1,
        prompt,
        customerImage,
        productImage,
      );
    } catch (error) {
      lastError = error;

      if (
        !shouldRetryCloudflarePrunaTryOnError(error) ||
        attempt >= CLOUDFLARE_PRUNA_RETRY_COUNT
      ) {
        break;
      }

      await delay(900 * (attempt + 1));
    }
  }

  throw lastError;
}

async function requestOpenAIImageEdit(
  env: TryOnRequestsEnv,
  requestId: string,
  attempt: number,
  prompt: string,
  customerImage: TryOnImageFile,
  productImage: TryOnImageFile,
): Promise<GeneratedTryOnImage> {
  const startedAt = Date.now();
  const model = getOpenAIImageModel(env);
  const size = env.OPENAI_IMAGE_SIZE || DEFAULT_OPENAI_IMAGE_SIZE;
  const quality = env.OPENAI_IMAGE_QUALITY || DEFAULT_OPENAI_IMAGE_QUALITY;
  const outputFormat = getOpenAIImageOutputFormat(env);
  const outputCompression = getOpenAIImageOutputCompression(env, outputFormat);
  const body = new FormData();
  body.append("model", model);
  body.append("prompt", prompt);
  body.append("image[]", customerImage);
  body.append("image[]", productImage);
  body.append("n", "1");
  body.append("size", size);
  body.append("quality", quality);
  body.append("output_format", outputFormat);

  if (outputCompression) {
    body.append("output_compression", outputCompression);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body,
    });
    const requestIdHeader = response.headers.get("x-request-id") || "";
    const payload = (await response.json()) as OpenAIImageResponse;

    console.info(
      "[try-on-ai]",
      JSON.stringify({
        event: "openai_image_edit_response",
        requestId,
        attempt,
        status: response.status,
        openaiRequestId: requestIdHeader,
        durationMs: Date.now() - startedAt,
        model,
        size,
        quality,
        outputFormat,
        outputCompression,
        customerImageBytes: customerImage.size,
        productImageBytes: productImage.size,
      }),
    );

    if (!response.ok) {
      throw new OpenAIImageEditError(
        payload.error?.message || "OpenAI không tạo được ảnh thử đồ.",
        response.status,
        requestIdHeader,
      );
    }

    const imageBase64 = payload.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI không trả về ảnh kết quả.");
    }

    return {
      bytes: decodeBase64ToBytes(imageBase64),
      contentType: getGeneratedImageContentType(outputFormat),
      extension: getGeneratedImageExtension(outputFormat),
      format: outputFormat,
      model,
      provider: "openai",
    };
  } catch (error) {
    console.warn(
      "[try-on-ai]",
      JSON.stringify({
        event: "openai_image_edit_error",
        requestId,
        attempt,
        durationMs: Date.now() - startedAt,
        model,
        size,
        quality,
        outputFormat,
        outputCompression,
        customerImageBytes: customerImage.size,
        productImageBytes: productImage.size,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage:
          error instanceof Error ? error.message : "Unknown OpenAI error",
        openaiStatus:
          error instanceof OpenAIImageEditError ? error.status : undefined,
        openaiRequestId:
          error instanceof OpenAIImageEditError
            ? error.openaiRequestId
            : undefined,
      }),
    );
    throw error;
  }
}

async function requestOpenAIImageEditWithRetry(
  env: TryOnRequestsEnv,
  requestId: string,
  prompt: string,
  customerImage: TryOnImageFile,
  productImage: TryOnImageFile,
): Promise<GeneratedTryOnImage> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= OPENAI_IMAGE_RETRY_COUNT; attempt += 1) {
    try {
      return await requestOpenAIImageEdit(
        env,
        requestId,
        attempt + 1,
        prompt,
        customerImage,
        productImage,
      );
    } catch (error) {
      lastError = error;

      if (
        !shouldRetryOpenAIImageError(error) ||
        attempt >= OPENAI_IMAGE_RETRY_COUNT
      ) {
        break;
      }

      await delay(900 * (attempt + 1));
    }
  }

  throw lastError;
}

function shouldRetryOpenAIImageError(error: unknown) {
  if (error instanceof OpenAIImageEditError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("network connection lost") ||
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function shouldRetryCloudflarePrunaTryOnError(error: unknown) {
  if (error instanceof CloudflarePrunaTryOnError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("network connection lost") ||
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function getTryOnAiProvider(env: TryOnRequestsEnv): TryOnAiProvider {
  const provider = (
    env.TRY_ON_AI_PROVIDER || DEFAULT_TRY_ON_AI_PROVIDER
  )
    .trim()
    .toLowerCase();

  if (provider === "cloudflare-pruna" || provider === "pruna") {
    return "cloudflare-pruna";
  }

  if (provider === "openai") {
    return "openai";
  }

  throw new TryOnRequestError(
    "TRY_ON_AI_PROVIDER phải là cloudflare-pruna hoặc openai.",
    400,
  );
}

function getOpenAIImageModel(env: TryOnRequestsEnv) {
  return env.OPENAI_IMAGE_MODEL || DEFAULT_OPENAI_IMAGE_MODEL;
}

function getCloudflarePrunaOutputFormat(env: TryOnRequestsEnv) {
  const outputFormat = (
    env.CLOUDFLARE_PRUNA_OUTPUT_FORMAT ||
    DEFAULT_CLOUDFLARE_PRUNA_OUTPUT_FORMAT
  )
    .trim()
    .toLowerCase();

  if (outputFormat === "jpeg") {
    return "jpg";
  }

  if (
    outputFormat === "jpg" ||
    outputFormat === "png" ||
    outputFormat === "webp"
  ) {
    return outputFormat;
  }

  return DEFAULT_CLOUDFLARE_PRUNA_OUTPUT_FORMAT;
}

function getCloudflarePrunaOutputQuality(env: TryOnRequestsEnv) {
  const quality = Number(
    env.CLOUDFLARE_PRUNA_OUTPUT_QUALITY ||
      DEFAULT_CLOUDFLARE_PRUNA_OUTPUT_QUALITY,
  );

  if (Number.isInteger(quality) && quality >= 0 && quality <= 100) {
    return quality;
  }

  return Number(DEFAULT_CLOUDFLARE_PRUNA_OUTPUT_QUALITY);
}

function getCloudflarePrunaBoolean(value: string | undefined, fallback: string) {
  const normalized = (value || fallback).trim().toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getCloudflareAiGatewayId(env: TryOnRequestsEnv) {
  return (
    (env.CLOUDFLARE_AI_GATEWAY_ID || "").trim() ||
    DEFAULT_CLOUDFLARE_AI_GATEWAY_ID
  );
}

function getOpenAIImageOutputFormat(env: TryOnRequestsEnv) {
  const outputFormat = (
    env.OPENAI_IMAGE_OUTPUT_FORMAT || DEFAULT_OPENAI_IMAGE_OUTPUT_FORMAT
  )
    .trim()
    .toLowerCase();

  if (
    outputFormat === "jpeg" ||
    outputFormat === "png" ||
    outputFormat === "webp"
  ) {
    return outputFormat;
  }

  return DEFAULT_OPENAI_IMAGE_OUTPUT_FORMAT;
}

function getOpenAIImageOutputCompression(
  env: TryOnRequestsEnv,
  outputFormat: string,
) {
  if (outputFormat === "png") {
    return "";
  }

  const rawValue =
    env.OPENAI_IMAGE_OUTPUT_COMPRESSION ||
    DEFAULT_OPENAI_IMAGE_OUTPUT_COMPRESSION;
  const compression = Number(rawValue);

  if (Number.isInteger(compression) && compression >= 0 && compression <= 100) {
    return String(compression);
  }

  return DEFAULT_OPENAI_IMAGE_OUTPUT_COMPRESSION;
}

function normalizeGeneratedImageContentType(
  contentType: string,
  outputFormat: string,
) {
  const normalizedContentType = contentType.split(";")[0].trim().toLowerCase();

  if (ALLOWED_IMAGE_TYPES.has(normalizedContentType)) {
    return normalizedContentType;
  }

  return getGeneratedImageContentType(outputFormat);
}

function getGeneratedImageContentType(outputFormat: string) {
  if (outputFormat === "webp") {
    return "image/webp";
  }

  if (outputFormat === "png") {
    return "image/png";
  }

  return "image/jpeg";
}

function getGeneratedImageExtension(outputFormat: string) {
  if (outputFormat === "webp") {
    return "webp";
  }

  if (outputFormat === "png") {
    return "png";
  }

  return "jpg";
}

class OpenAIImageEditError extends Error {
  status: number;
  openaiRequestId: string;

  constructor(message: string, status: number, openaiRequestId: string) {
    super(message);
    this.name = "OpenAIImageEditError";
    this.status = status;
    this.openaiRequestId = openaiRequestId;
  }
}

class CloudflarePrunaTryOnError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CloudflarePrunaTryOnError";
    this.status = status;
  }
}

function normalizeCloudflarePrunaTryOnError(
  error: unknown,
  gatewayId: string,
) {
  if (error instanceof CloudflarePrunaTryOnError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message
      : "Unknown Cloudflare Pruna error";

  if (isCloudflareInvalidCredentialsError(message)) {
    return new CloudflarePrunaTryOnError(
      [
        "Cloudflare AI Gateway chưa xác thực được model third-party.",
        `Hãy kiểm tra gateway '${gatewayId}' và nạp Unified Billing credits trong Cloudflare AI Gateway.`,
        `Lỗi gốc: ${message}`,
      ].join(" "),
      401,
    );
  }

  return error;
}

function isCloudflareInvalidCredentialsError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("invalid user credentials") ||
    normalizedMessage.includes("2021:")
  );
}

function getCloudflarePrunaErrorMessage(payload: CloudflarePrunaTryOnResponse) {
  if (payload.success === false) {
    return (
      payload.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
      "Cloudflare Pruna không tạo được ảnh thử đồ."
    );
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (payload.error?.message) {
    return payload.error.message;
  }

  return "";
}

async function toImageDataUri(image: TryOnImageFile) {
  const bytes = new Uint8Array(await image.arrayBuffer());

  return `data:${image.type};base64,${encodeBase64(bytes)}`;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function buildTryOnPrompt(request: TryOnGenerationRow) {
  const details = [
    `Product name: ${request.product_name}`,
    `Category: ${request.product_category}`,
    request.product_age_group ? `Age range: ${request.product_age_group}` : "",
    request.product_weight_range
      ? `Weight range: ${request.product_weight_range}`
      : "",
    request.product_description
      ? `Product notes: ${request.product_description}`
      : "",
  ].filter(Boolean);

  return [
    "Create a respectful, child-safe virtual try-on preview for a children's clothing shop.",
    "Use the first reference image as the customer's photo and preserve the child's face, body shape, pose, skin tone, hair, and background as much as possible.",
    "Use the second reference image as the clothing product reference.",
    "Show the child fully clothed wearing the referenced product. Keep the styling realistic, modest, and non-sexualized.",
    "Do not make the child look older or younger. Do not add nudity, underwear-only styling, lingerie styling, or revealing poses.",
    "Make the clothing fit naturally while preserving the product's key color, pattern, silhouette, and visible details.",
    "Return one photorealistic final image suitable for private admin review.",
    details.join("\n"),
  ].join("\n\n");
}

function appendAdminNote(existingNote: string | null, note: string) {
  const nextNote = [existingNote || "", note]
    .filter(Boolean)
    .join("\n")
    .trim();

  return nextNote.slice(-500);
}

function removeAiGenerationProgressNote(existingNote: string | null) {
  return (existingNote || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("AI lỗi:") &&
        line !== "AI đang tạo ảnh." &&
        !line.startsWith("AI đã tạo ảnh kết quả bằng "),
    )
    .join("\n");
}

function resetAiGenerationNote(existingNote: string | null) {
  const preservedNote = removeAiGenerationProgressNote(existingNote);

  return appendAdminNote(preservedNote || null, "AI đang tạo ảnh.");
}

function inferImageContentType(objectKey: string) {
  const extension = objectKey.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  return "image/png";
}

function decodeBase64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
