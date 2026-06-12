import { getProduct, type ProductsEnv } from "./products";

const MAX_IMAGE_COUNT = 6;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type ProductImagesEnv = ProductsEnv & {
  PRODUCT_IMAGES: R2Bucket;
};

type ImageRecord = {
  id: string;
  product_id: string;
  object_key: string;
  is_primary: number;
};

export async function uploadProductImages(
  env: ProductImagesEnv,
  productId: string,
  files: File[],
) {
  const product = await getProduct(env.DB, productId);

  if (!product) {
    throw new ProductImageError("Không tìm thấy sản phẩm.", 404);
  }

  const existingCount = await countProductImages(env.DB, productId);

  if (files.length === 0) {
    throw new ProductImageError("Hãy chọn ít nhất một ảnh.", 400);
  }

  if (existingCount + files.length > MAX_IMAGE_COUNT) {
    throw new ProductImageError(
      `Mỗi sản phẩm được tải tối đa ${MAX_IMAGE_COUNT} ảnh.`,
      400,
    );
  }

  const uploadedKeys: string[] = [];

  try {
    for (const [index, file] of files.entries()) {
      validateImage(file);

      const id = crypto.randomUUID();
      const extension = ALLOWED_IMAGE_TYPES.get(file.type);
      const objectKey = `products/${productId}/${id}.${extension}`;
      const publicUrl = `/api/product-images/${id}`;

      await env.PRODUCT_IMAGES.put(objectKey, file.stream(), {
        httpMetadata: {
          contentType: file.type,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          originalName: file.name.slice(0, 180),
          productId,
        },
      });
      uploadedKeys.push(objectKey);

      await env.DB.prepare(
        `INSERT INTO product_images (
          id, product_id, object_key, public_url, alt_text, sort_order, is_primary
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          productId,
          objectKey,
          publicUrl,
          product.name,
          existingCount + index,
          existingCount === 0 && index === 0 ? 1 : 0,
        )
        .run();
    }
  } catch (error) {
    if (uploadedKeys.length > 0) {
      await env.PRODUCT_IMAGES.delete(uploadedKeys);
      await env.DB.prepare(
        `DELETE FROM product_images
         WHERE product_id = ? AND object_key IN (${uploadedKeys.map(() => "?").join(", ")})`,
      )
        .bind(productId, ...uploadedKeys)
        .run();
    }

    throw error;
  }

  return getProduct(env.DB, productId);
}

export async function getProductImage(
  env: ProductImagesEnv,
  imageId: string,
) {
  const image = await findImage(env.DB, imageId);

  if (!image) {
    return null;
  }

  const object = await env.PRODUCT_IMAGES.get(image.object_key);

  if (!object) {
    return null;
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, s-maxage=604800");
  headers.set("x-content-type-options", "nosniff");

  return new Response(object.body, { headers });
}

export async function deleteProductImage(
  env: ProductImagesEnv,
  imageId: string,
) {
  const image = await findImage(env.DB, imageId);

  if (!image) {
    return null;
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM product_images WHERE id = ?").bind(imageId),
    env.DB
      .prepare(
        `UPDATE product_images SET is_primary = 1
         WHERE id = (
           SELECT id FROM product_images
           WHERE product_id = ?
           ORDER BY sort_order, created_at
           LIMIT 1
         )
         AND NOT EXISTS (
           SELECT 1 FROM product_images
           WHERE product_id = ? AND is_primary = 1
         )`,
      )
      .bind(image.product_id, image.product_id),
  ]);
  await env.PRODUCT_IMAGES.delete(image.object_key);

  return getProduct(env.DB, image.product_id);
}

export async function setPrimaryProductImage(
  env: ProductImagesEnv,
  imageId: string,
) {
  const image = await findImage(env.DB, imageId);

  if (!image) {
    return null;
  }

  await env.DB.batch([
    env.DB
      .prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?")
      .bind(image.product_id),
    env.DB
      .prepare("UPDATE product_images SET is_primary = 1 WHERE id = ?")
      .bind(imageId),
  ]);

  return getProduct(env.DB, image.product_id);
}

export class ProductImageError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new ProductImageError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.", 400);
  }

  if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    throw new ProductImageError("Mỗi ảnh phải nhỏ hơn hoặc bằng 5 MB.", 400);
  }
}

async function countProductImages(db: D1Database, productId: string) {
  const result = await db
    .prepare("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?")
    .bind(productId)
    .first<{ count: number }>();

  return Number(result?.count || 0);
}

async function findImage(db: D1Database, imageId: string) {
  return db
    .prepare(
      `SELECT id, product_id, object_key, is_primary
       FROM product_images WHERE id = ? LIMIT 1`,
    )
    .bind(imageId)
    .first<ImageRecord>();
}
