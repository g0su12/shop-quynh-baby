const FALLBACK_IMAGE_URL = "/assets/mock-hero-catalog.png";

export type ProductsEnv = {
  DB: D1Database;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  gender: "boy" | "girl" | "unisex";
  age_group: string | null;
  weight_range: string | null;
  is_visible: number;
  is_featured: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  size_label: string;
  color_label: string | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  sort_order: number;
};

type ImageRow = {
  id: string;
  product_id: string;
  public_url: string | null;
  alt_text: string | null;
  sort_order: number;
  is_primary: number;
};

export type ProductPayload = {
  name: string;
  description: string;
  category: string;
  gender: "boy" | "girl" | "unisex";
  ageGroup: string;
  weightRange: string;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  isFeatured: boolean;
  isVisible: boolean;
  variants: Array<{
    sizeLabel: string;
    colorLabel: string;
    stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  }>;
};

export async function listProducts(db: D1Database, includeHidden: boolean) {
  const productQuery = includeHidden
    ? "SELECT * FROM products ORDER BY is_featured DESC, created_at DESC"
    : "SELECT * FROM products WHERE is_visible = 1 ORDER BY is_featured DESC, created_at DESC";
  const [productResult, variantResult, imageResult] = await db.batch([
    db.prepare(productQuery),
    db.prepare("SELECT * FROM product_variants ORDER BY product_id, sort_order, created_at"),
    db.prepare("SELECT * FROM product_images ORDER BY product_id, is_primary DESC, sort_order"),
  ]);
  const productRows = (productResult.results || []) as ProductRow[];
  const variantRows = (variantResult.results || []) as VariantRow[];
  const imageRows = (imageResult.results || []) as ImageRow[];

  return mapProducts(productRows, variantRows, imageRows);
}

export async function getProduct(db: D1Database, id: string) {
  const [productResult, variantResult, imageResult] = await db.batch([
    db.prepare("SELECT * FROM products WHERE id = ? LIMIT 1").bind(id),
    db
      .prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, created_at")
      .bind(id),
    db
      .prepare(
        "SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order",
      )
      .bind(id),
  ]);
  const productRows = (productResult.results || []) as ProductRow[];

  if (productRows.length === 0) {
    return null;
  }

  return mapProducts(
    productRows,
    (variantResult.results || []) as VariantRow[],
    (imageResult.results || []) as ImageRow[],
  )[0];
}

export async function getProductBySlug(
  db: D1Database,
  slug: string,
  includeHidden = false,
) {
  const productQuery = includeHidden
    ? "SELECT * FROM products WHERE slug = ? LIMIT 1"
    : "SELECT * FROM products WHERE slug = ? AND is_visible = 1 LIMIT 1";
  const productResult = await db.prepare(productQuery).bind(slug).all();
  const productRows = (productResult.results || []) as ProductRow[];
  const product = productRows[0];

  if (!product) {
    return null;
  }

  return getProduct(db, product.id);
}

export async function createProduct(db: D1Database, payload: ProductPayload) {
  const id = crypto.randomUUID();
  const slug = `${slugify(payload.name)}-${id.slice(0, 8)}`;
  const statements = [
    db
      .prepare(
        `INSERT INTO products (
          id, name, slug, description, category, gender, age_group, weight_range,
          is_visible, is_featured, stock_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        payload.name,
        slug,
        payload.description,
        payload.category,
        payload.gender,
        payload.ageGroup,
        payload.weightRange,
        payload.isVisible ? 1 : 0,
        payload.isFeatured ? 1 : 0,
        payload.stockStatus,
      ),
    ...createVariantStatements(db, id, payload),
  ];

  await db.batch(statements);

  return getProduct(db, id);
}

export async function updateProduct(
  db: D1Database,
  id: string,
  payload: ProductPayload,
) {
  const existing = await getProduct(db, id);

  if (!existing) {
    return null;
  }

  await db.batch([
    db
      .prepare(
        `UPDATE products SET
          name = ?, description = ?, category = ?, gender = ?, age_group = ?,
          weight_range = ?, is_visible = ?, is_featured = ?, stock_status = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
      )
      .bind(
        payload.name,
        payload.description,
        payload.category,
        payload.gender,
        payload.ageGroup,
        payload.weightRange,
        payload.isVisible ? 1 : 0,
        payload.isFeatured ? 1 : 0,
        payload.stockStatus,
        id,
      ),
    db.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(id),
    ...createVariantStatements(db, id, payload),
  ]);

  return getProduct(db, id);
}

export async function updateProductVisibility(
  db: D1Database,
  id: string,
  isVisible: boolean,
) {
  const result = await db
    .prepare(
      "UPDATE products SET is_visible = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(isVisible ? 1 : 0, id)
    .run();

  if (!result.meta.changes) {
    return null;
  }

  return getProduct(db, id);
}

export function validateProductPayload(value: unknown): ProductPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Dữ liệu sản phẩm không hợp lệ.");
  }

  const input = value as Partial<ProductPayload>;
  const name = cleanText(input.name);
  const category = cleanText(input.category);
  const gender = input.gender;
  const stockStatus = input.stockStatus;

  if (!name || name.length > 160) {
    throw new Error("Tên sản phẩm là bắt buộc và tối đa 160 ký tự.");
  }

  if (!category || category.length > 80) {
    throw new Error("Danh mục sản phẩm là bắt buộc.");
  }

  if (!isGender(gender)) {
    throw new Error("Giới tính sản phẩm không hợp lệ.");
  }

  if (!isStockStatus(stockStatus)) {
    throw new Error("Tình trạng sản phẩm không hợp lệ.");
  }

  if (!Array.isArray(input.variants) || input.variants.length === 0) {
    throw new Error("Sản phẩm phải có ít nhất một size.");
  }

  const variants = input.variants.map((variant) => {
    const sizeLabel = cleanText(variant?.sizeLabel);
    const colorLabel = cleanText(variant?.colorLabel);

    if (!sizeLabel || sizeLabel.length > 40) {
      throw new Error("Mỗi biến thể phải có size hợp lệ.");
    }

    if (!isStockStatus(variant?.stockStatus)) {
      throw new Error(`Tình trạng size ${sizeLabel} không hợp lệ.`);
    }

    return {
      sizeLabel,
      colorLabel,
      stockStatus: variant.stockStatus,
    };
  });

  return {
    name,
    description: cleanText(input.description),
    category,
    gender,
    ageGroup: cleanText(input.ageGroup),
    weightRange: cleanText(input.weightRange),
    stockStatus,
    isFeatured: Boolean(input.isFeatured),
    isVisible: input.isVisible !== false,
    variants,
  };
}

function createVariantStatements(
  db: D1Database,
  productId: string,
  payload: ProductPayload,
) {
  return payload.variants.map((variant, index) =>
    db
      .prepare(
        `INSERT INTO product_variants (
          id, product_id, size_label, color_label, stock_status, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        productId,
        variant.sizeLabel,
        variant.colorLabel || null,
        variant.stockStatus,
        index,
      ),
  );
}

function mapProducts(
  products: ProductRow[],
  variants: VariantRow[],
  images: ImageRow[],
) {
  const variantsByProduct = new Map<string, VariantRow[]>();
  const imagesByProduct = new Map<string, ImageRow[]>();

  for (const variant of variants) {
    const rows = variantsByProduct.get(variant.product_id) || [];
    rows.push(variant);
    variantsByProduct.set(variant.product_id, rows);
  }

  for (const image of images) {
    const rows = imagesByProduct.get(image.product_id) || [];
    rows.push(image);
    imagesByProduct.set(image.product_id, rows);
  }

  return products.map((product) => {
    const productVariants = variantsByProduct.get(product.id) || [];
    const productImages = imagesByProduct.get(product.id) || [];
    const sizes = [...new Set(productVariants.map((variant) => variant.size_label))];
    const colors = [
      ...new Set(
        productVariants
          .map((variant) => variant.color_label)
          .filter((color): color is string => Boolean(color)),
      ),
    ];

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description || "",
      category: product.category,
      gender: product.gender,
      ageGroup: product.age_group || "",
      weightRange: product.weight_range || "",
      stockStatus: product.stock_status,
      isVisible: Boolean(product.is_visible),
      isFeatured: Boolean(product.is_featured),
      imageUrl: productImages[0]?.public_url || FALLBACK_IMAGE_URL,
      sizes,
      colors,
      variants: productVariants.map((variant) => ({
        id: variant.id,
        sizeLabel: variant.size_label,
        colorLabel: variant.color_label || "",
        stockStatus: variant.stock_status,
      })),
      images: productImages.map((image) => ({
        id: image.id,
        url: image.public_url || "",
        altText: image.alt_text || product.name,
        isPrimary: Boolean(image.is_primary),
        sortOrder: image.sort_order,
      })),
    };
  });
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isGender(value: unknown): value is ProductPayload["gender"] {
  return value === "boy" || value === "girl" || value === "unisex";
}

function isStockStatus(value: unknown): value is ProductPayload["stockStatus"] {
  return value === "in_stock" || value === "low_stock" || value === "out_of_stock";
}
