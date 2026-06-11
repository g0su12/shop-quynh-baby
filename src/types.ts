export type Gender = "boy" | "girl" | "unisex";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

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
  weightRange: string;
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
  weightRange: string;
  stockStatus: StockStatus;
  isFeatured: boolean;
  isVisible: boolean;
  variants: Array<{
    sizeLabel: string;
    colorLabel: string;
    stockStatus: StockStatus;
  }>;
};
