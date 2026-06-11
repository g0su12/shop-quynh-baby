INSERT OR IGNORE INTO products (
  id,
  name,
  slug,
  description,
  category,
  gender,
  age_group,
  weight_range,
  is_visible,
  is_featured,
  stock_status
) VALUES
  ('p001', 'Set cotton pastel đi chơi', 'set-cotton-pastel-di-choi', 'Chất cotton mềm, form thoải mái cho bé mặc hằng ngày.', 'Bộ đồ', 'unisex', '6-12 tháng', '7-10kg', 1, 1, 'in_stock'),
  ('p002', 'Váy hoa nhẹ nhàng', 'vay-hoa-nhe-nhang', 'Váy mềm, màu sáng, hợp đi chơi hoặc chụp ảnh gia đình.', 'Váy', 'girl', '1-2 tuổi', '9-13kg', 1, 1, 'low_stock'),
  ('p003', 'Áo thun basic dễ phối', 'ao-thun-basic-de-phoi', 'Áo thun nhẹ, dễ phối với quần short hoặc quần dài.', 'Áo', 'boy', '3-5 tuổi', '13-18kg', 1, 1, 'in_stock'),
  ('p004', 'Quần short mềm mùa hè', 'quan-short-mem-mua-he', 'Form rộng, mặc mát, phù hợp thời tiết nóng.', 'Quần', 'unisex', '1-2 tuổi', '9-13kg', 1, 0, 'out_of_stock');

INSERT OR IGNORE INTO product_variants (
  id,
  product_id,
  size_label,
  color_label,
  stock_status,
  sort_order
) VALUES
  ('v001', 'p001', '80', 'Kem', 'in_stock', 1),
  ('v002', 'p001', '90', 'Xanh mint', 'in_stock', 2),
  ('v003', 'p002', '90', 'Hồng', 'low_stock', 1),
  ('v004', 'p002', '100', 'Trắng', 'in_stock', 2),
  ('v005', 'p003', '100', 'Xanh', 'in_stock', 1),
  ('v006', 'p003', '110', 'Be', 'in_stock', 2),
  ('v007', 'p003', '120', 'Be', 'in_stock', 3),
  ('v008', 'p004', '90', 'Nâu nhạt', 'out_of_stock', 1);
