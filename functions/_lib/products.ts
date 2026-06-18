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
  age_min_months?: number | null;
  age_max_months?: number | null;
  weight_range: string | null;
  weight_min_kg?: number | null;
  weight_max_kg?: number | null;
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

type ProductImageKeyRow = {
  object_key: string;
};

type NumericRange = {
  min: number;
  max: number;
};

export type ProductPayload = {
  name: string;
  description: string;
  category: string;
  gender: "boy" | "girl" | "unisex";
  ageGroup: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  weightRange: string;
  weightMinKg: number;
  weightMaxKg: number;
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
          id, name, slug, description, category, gender, age_group,
          age_min_months, age_max_months, weight_range, weight_min_kg,
          weight_max_kg, is_visible, is_featured, stock_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        payload.name,
        slug,
        payload.description,
        payload.category,
        payload.gender,
        payload.ageGroup,
        payload.ageMinMonths,
        payload.ageMaxMonths,
        payload.weightRange,
        payload.weightMinKg,
        payload.weightMaxKg,
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
          age_min_months = ?, age_max_months = ?, weight_range = ?,
          weight_min_kg = ?, weight_max_kg = ?, is_visible = ?,
          is_featured = ?, stock_status = ?, updated_at = datetime('now')
        WHERE id = ?`,
      )
      .bind(
        payload.name,
        payload.description,
        payload.category,
        payload.gender,
        payload.ageGroup,
        payload.ageMinMonths,
        payload.ageMaxMonths,
        payload.weightRange,
        payload.weightMinKg,
        payload.weightMaxKg,
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

export async function deleteProduct(db: D1Database, id: string) {
  const existingProduct = await getProduct(db, id);

  if (!existingProduct) {
    return null;
  }

  const imageResult = await db
    .prepare("SELECT object_key FROM product_images WHERE product_id = ?")
    .bind(id)
    .all<ProductImageKeyRow>();
  const imageKeys = (imageResult.results || [])
    .map((image) => image.object_key)
    .filter(Boolean);

  await db.batch([
    db.prepare("DELETE FROM product_variants WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM products WHERE id = ?").bind(id),
  ]);

  return {
    imageKeys,
    product: existingProduct,
  };
}

export function validateProductPayload(value: unknown): ProductPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Dữ liệu sản phẩm không hợp lệ.");
  }

  const input = value as Partial<ProductPayload>;
  const name = cleanText(input.name);
  const category = cleanText(input.category);
  const rawAgeGroup = cleanText(input.ageGroup);
  const rawWeightRange = cleanText(input.weightRange);
  const gender = input.gender;
  const stockStatus = input.stockStatus;
  const ageRange =
    readBoundedRange(
      input.ageMinMonths,
      input.ageMaxMonths,
      { min: 12, max: 216 },
      "Độ tuổi",
      "1-18 tuổi",
      true,
    ) || parseAgeRangeToMonths(rawAgeGroup);
  const weightRange =
    readBoundedRange(
      input.weightMinKg,
      input.weightMaxKg,
      { min: 5, max: 40 },
      "Cân nặng",
      "5-40kg",
      false,
    ) || parseWeightRangeToKg(rawWeightRange);

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

  if (!ageRange) {
    throw new Error("Hãy nhập khoảng độ tuổi trong khoảng 1-18 tuổi.");
  }

  if (!rangeWithin(ageRange, { min: 12, max: 216 })) {
    throw new Error("Độ tuổi sản phẩm phải nằm trong khoảng 1-18 tuổi.");
  }

  if (!weightRange) {
    throw new Error("Hãy nhập khoảng cân nặng trong khoảng 5-40kg.");
  }

  if (!rangeWithin(weightRange, { min: 5, max: 40 })) {
    throw new Error("Cân nặng sản phẩm phải nằm trong khoảng 5-40kg.");
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
    ageGroup: formatAgeRangeLabel(ageRange),
    ageMinMonths: ageRange.min,
    ageMaxMonths: ageRange.max,
    weightRange: formatWeightRangeLabel(weightRange),
    weightMinKg: weightRange.min,
    weightMaxKg: weightRange.max,
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
    const ageRange = resolveAgeRange(product);
    const weightRange = resolveWeightRange(product);
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
      ageGroup: ageRange
        ? formatAgeRangeLabel(ageRange)
        : product.age_group || "",
      ageMinMonths: ageRange?.min ?? null,
      ageMaxMonths: ageRange?.max ?? null,
      weightRange: weightRange
        ? formatWeightRangeLabel(weightRange)
        : product.weight_range || "",
      weightMinKg: weightRange?.min ?? null,
      weightMaxKg: weightRange?.max ?? null,
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

function resolveAgeRange(product: ProductRow) {
  return (
    normalizeNumericRangeFromValues(
      product.age_min_months,
      product.age_max_months,
    ) || parseAgeRangeToMonths(product.age_group || "")
  );
}

function resolveWeightRange(product: ProductRow) {
  return (
    normalizeNumericRangeFromValues(product.weight_min_kg, product.weight_max_kg) ||
    parseWeightRangeToKg(product.weight_range || "")
  );
}

function readBoundedRange(
  minValue: unknown,
  maxValue: unknown,
  bounds: NumericRange,
  label: string,
  boundsLabel: string,
  requireInteger: boolean,
) {
  const min = readOptionalNumber(minValue);
  const max = readOptionalNumber(maxValue);

  if (min === null && max === null) {
    return null;
  }

  if (min === null || max === null) {
    throw new Error(`${label} cần nhập đủ giá trị từ và đến.`);
  }

  if (requireInteger && (!Number.isInteger(min) || !Number.isInteger(max))) {
    throw new Error(`${label} phải là số nguyên.`);
  }

  if (min > max) {
    throw new Error(`${label} bắt đầu phải nhỏ hơn hoặc bằng kết thúc.`);
  }

  if (!rangeWithin({ min, max }, bounds)) {
    throw new Error(`${label} phải nằm trong khoảng ${boundsLabel}.`);
  }

  return { min, max };
}

function readOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));

  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseAgeRangeToMonths(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:-|đến|to)?\s*(\d+(?:[.,]\d+)?)?\s*(tháng|tuổi)?/,
  );

  if (!match) {
    return null;
  }

  const firstValue = parseLocalizedNumber(match[1]);
  const secondValue = match[2] ? parseLocalizedNumber(match[2]) : firstValue;
  const multiplier = match[3] === "tháng" ? 1 : 12;

  return normalizeNumericRange({
    min: firstValue * multiplier,
    max: secondValue * multiplier,
  });
}

function parseWeightRangeToKg(value: string) {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:-|đến|to)?\s*(\d+(?:[.,]\d+)?)?\s*(?:kg)?/,
  );

  if (!match) {
    return null;
  }

  const firstValue = parseLocalizedNumber(match[1]);
  const secondValue = match[2] ? parseLocalizedNumber(match[2]) : firstValue;

  return normalizeNumericRange({
    min: firstValue,
    max: secondValue,
  });
}

function normalizeNumericRangeFromValues(
  min: number | null | undefined,
  max: number | null | undefined,
) {
  if (min === null || min === undefined || max === null || max === undefined) {
    return null;
  }

  return normalizeNumericRange({ min, max });
}

function normalizeNumericRange(range: NumericRange) {
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
    return null;
  }

  return {
    min: Math.min(range.min, range.max),
    max: Math.max(range.min, range.max),
  };
}

function rangeWithin(range: NumericRange, bounds: NumericRange) {
  return range.min >= bounds.min && range.max <= bounds.max;
}

function parseLocalizedNumber(value: string) {
  return Number(value.replace(",", "."));
}

function formatAgeRangeLabel(range: NumericRange) {
  if (range.min === range.max) {
    return formatAgeMonths(range.min);
  }

  const minYears = range.min / 12;
  const maxYears = range.max / 12;

  if (Number.isInteger(minYears) && Number.isInteger(maxYears)) {
    return `${formatNumber(minYears)}-${formatNumber(maxYears)} tuổi`;
  }

  return `${formatAgeMonths(range.min)}-${formatAgeMonths(range.max)}`;
}

function formatAgeMonths(value: number) {
  if (value < 12) {
    return `${formatNumber(value)} tháng`;
  }

  if (value % 12 === 0) {
    return `${formatNumber(value / 12)} tuổi`;
  }

  const years = Math.floor(value / 12);
  const months = value % 12;

  return `${years} tuổi ${formatNumber(months)} tháng`;
}

function formatWeightRangeLabel(range: NumericRange) {
  if (range.min === range.max) {
    return `${formatNumber(range.min)}kg`;
  }

  return `${formatNumber(range.min)}-${formatNumber(range.max)}kg`;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toString()
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
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
