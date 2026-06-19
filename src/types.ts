export type Gender = "boy" | "girl" | "unisex";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ContactChannel = "zalo" | "facebook" | "phone";

export type TryOnStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

export type ProductVariant = {
  id: string;
  sizeLabel: string;
  colorLabel: string;
  stockStatus: StockStatus;
};

export type ProductImage = {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  gender: Gender;
  ageGroup: string;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  weightRange: string;
  weightMinKg: number | null;
  weightMaxKg: number | null;
  sizes: string[];
  colors: string[];
  stockStatus: StockStatus;
  isFeatured: boolean;
  isVisible: boolean;
  imageUrl: string;
  images: ProductImage[];
  variants: ProductVariant[];
  description: string;
};

export type ProductInput = {
  name: string;
  description: string;
  category: string;
  gender: Gender;
  ageGroup: string;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  weightRange: string;
  weightMinKg: number | null;
  weightMaxKg: number | null;
  stockStatus: StockStatus;
  isFeatured: boolean;
  isVisible: boolean;
  variants: Array<{
    sizeLabel: string;
    colorLabel: string;
    stockStatus: StockStatus;
  }>;
};

export type TryOnRequest = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  customerName: string;
  customerPhone: string;
  customerContactChannel: ContactChannel;
  inputImageUrl: string;
  resultImageUrl: string;
  status: TryOnStatus;
  adminNote: string;
  createdAt: string;
  processedAt: string;
  expiresAt: string;
};
