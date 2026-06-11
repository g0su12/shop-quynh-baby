export type Gender = "boy" | "girl" | "unisex";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

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
  imageUrl: string;
  description: string;
};
