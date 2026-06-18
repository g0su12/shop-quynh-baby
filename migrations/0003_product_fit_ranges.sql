ALTER TABLE products ADD COLUMN age_min_months INTEGER;
ALTER TABLE products ADD COLUMN age_max_months INTEGER;
ALTER TABLE products ADD COLUMN weight_min_kg REAL;
ALTER TABLE products ADD COLUMN weight_max_kg REAL;

CREATE INDEX IF NOT EXISTS idx_products_age_range ON products(age_min_months, age_max_months);
CREATE INDEX IF NOT EXISTS idx_products_weight_range ON products(weight_min_kg, weight_max_kg);

UPDATE products
SET
  age_group = '1-2 tuổi',
  age_min_months = 12,
  age_max_months = 24,
  weight_min_kg = 7,
  weight_max_kg = 10
WHERE id = 'p001'
  AND age_min_months IS NULL
  AND age_max_months IS NULL
  AND weight_min_kg IS NULL
  AND weight_max_kg IS NULL;

UPDATE products
SET
  age_min_months = 12,
  age_max_months = 24,
  weight_min_kg = 9,
  weight_max_kg = 13
WHERE id IN ('p002', 'p004')
  AND age_min_months IS NULL
  AND age_max_months IS NULL
  AND weight_min_kg IS NULL
  AND weight_max_kg IS NULL;

UPDATE products
SET
  age_min_months = 36,
  age_max_months = 60,
  weight_min_kg = 13,
  weight_max_kg = 18
WHERE id = 'p003'
  AND age_min_months IS NULL
  AND age_max_months IS NULL
  AND weight_min_kg IS NULL
  AND weight_max_kg IS NULL;
