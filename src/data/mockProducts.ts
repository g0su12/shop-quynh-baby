import type { Product } from "../types";

const mockImage = "/assets/mock-hero-catalog.png";

export const products: Product[] = [
  {
    id: "p001",
    name: "Set cotton pastel đi chơi",
    slug: "set-cotton-pastel-di-choi",
    category: "Bộ đồ",
    gender: "unisex",
    ageGroup: "6-12 tháng",
    weightRange: "7-10kg",
    sizes: ["80", "90"],
    colors: ["Kem", "Xanh mint"],
    stockStatus: "in_stock",
    isFeatured: true,
    imageUrl: mockImage,
    description: "Chất cotton mềm, form thoải mái cho bé mặc hằng ngày.",
  },
  {
    id: "p002",
    name: "Váy hoa nhẹ nhàng",
    slug: "vay-hoa-nhe-nhang",
    category: "Váy",
    gender: "girl",
    ageGroup: "1-2 tuổi",
    weightRange: "9-13kg",
    sizes: ["90", "100"],
    colors: ["Hồng", "Trắng"],
    stockStatus: "low_stock",
    isFeatured: true,
    imageUrl: mockImage,
    description: "Váy mềm, màu sáng, hợp đi chơi hoặc chụp ảnh gia đình.",
  },
  {
    id: "p003",
    name: "Áo thun basic dễ phối",
    slug: "ao-thun-basic-de-phoi",
    category: "Áo",
    gender: "boy",
    ageGroup: "3-5 tuổi",
    weightRange: "13-18kg",
    sizes: ["100", "110", "120"],
    colors: ["Xanh", "Be"],
    stockStatus: "in_stock",
    isFeatured: true,
    imageUrl: mockImage,
    description: "Áo thun nhẹ, dễ phối với quần short hoặc quần dài.",
  },
  {
    id: "p004",
    name: "Quần short mềm mùa hè",
    slug: "quan-short-mem-mua-he",
    category: "Quần",
    gender: "unisex",
    ageGroup: "1-2 tuổi",
    weightRange: "9-13kg",
    sizes: ["90"],
    colors: ["Nâu nhạt", "Xanh nhạt"],
    stockStatus: "out_of_stock",
    isFeatured: false,
    imageUrl: mockImage,
    description: "Form rộng, mặc mát, phù hợp thời tiết nóng.",
  },
];

export const categoryOptions = ["Tất cả", "Áo", "Quần", "Váy", "Bộ đồ", "Phụ kiện"];
export const genderOptions = ["Tất cả", "Bé trai", "Bé gái", "Unisex"];
export const ageOptions = ["Tất cả", "0-6 tháng", "6-12 tháng", "1-2 tuổi", "3-5 tuổi"];
