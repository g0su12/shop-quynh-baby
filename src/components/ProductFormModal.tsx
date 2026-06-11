import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type {
  Gender,
  Product,
  ProductInput,
  StockStatus,
} from "../types";

type ProductFormModalProps = {
  product: Product | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: ProductInput) => Promise<void>;
};

const categoryOptions = ["Áo", "Quần", "Váy", "Bộ đồ", "Phụ kiện"];
const genderOptions: Array<{ label: string; value: Gender }> = [
  { label: "Bé trai", value: "boy" },
  { label: "Bé gái", value: "girl" },
  { label: "Unisex", value: "unisex" },
];
const stockOptions: Array<{ label: string; value: StockStatus }> = [
  { label: "Còn hàng", value: "in_stock" },
  { label: "Sắp hết", value: "low_stock" },
  { label: "Hết hàng", value: "out_of_stock" },
];

function ProductFormModal({
  product,
  isSaving,
  onClose,
  onSave,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(() => createInitialForm(product));
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setForm(createInitialForm(product));
    setSubmitError("");
  }, [product]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    try {
      await onSave({
        ...form,
        variants: form.variants.filter((variant) => variant.sizeLabel.trim()),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Không thể lưu sản phẩm.",
      );
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section
        aria-labelledby="product-form-title"
        aria-modal="true"
        className="admin-modal"
        role="dialog"
      >
        <header className="admin-modal-header">
          <div>
            <p className="eyebrow">Catalog</p>
            <h2 id="product-form-title">
              {product ? "Sửa sản phẩm" : "Thêm sản phẩm"}
            </h2>
          </div>
          <button
            aria-label="Đóng form"
            className="admin-icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form className="admin-product-form" onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <label className="admin-form-field admin-form-field-wide">
              <span>Tên sản phẩm</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={form.name}
              />
            </label>

            <label className="admin-form-field">
              <span>Danh mục</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                value={form.category}
              >
                {categoryOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="admin-form-field">
              <span>Dành cho</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    gender: event.target.value as Gender,
                  }))
                }
                value={form.gender}
              >
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-form-field">
              <span>Độ tuổi</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ageGroup: event.target.value,
                  }))
                }
                placeholder="Ví dụ: 1-2 tuổi"
                value={form.ageGroup}
              />
            </label>

            <label className="admin-form-field">
              <span>Cân nặng</span>
              <input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    weightRange: event.target.value,
                  }))
                }
                placeholder="Ví dụ: 9-13kg"
                value={form.weightRange}
              />
            </label>

            <label className="admin-form-field">
              <span>Tình trạng chung</span>
              <select
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stockStatus: event.target.value as StockStatus,
                  }))
                }
                value={form.stockStatus}
              >
                {stockOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-form-field admin-form-field-wide">
              <span>Mô tả</span>
              <textarea
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                value={form.description}
              />
            </label>
          </div>

          <fieldset className="admin-form-options">
            <label>
              <input
                checked={form.isFeatured}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isFeatured: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>Sản phẩm nổi bật</span>
            </label>
            <label>
              <input
                checked={form.isVisible}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isVisible: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>Hiển thị trên website</span>
            </label>
          </fieldset>

          <section className="admin-variant-editor">
            <div className="admin-variant-heading">
              <div>
                <h3>Size và màu còn hàng</h3>
                <p>Mỗi dòng là một biến thể sản phẩm.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    variants: [
                      ...current.variants,
                      {
                        sizeLabel: "",
                        colorLabel: "",
                        stockStatus: "in_stock",
                      },
                    ],
                  }))
                }
                type="button"
              >
                <Plus aria-hidden="true" />
                <span>Thêm size</span>
              </button>
            </div>

            <div className="admin-variant-list">
              {form.variants.map((variant, index) => (
                <div className="admin-variant-row" key={`variant-${index}`}>
                  <label className="admin-form-field">
                    <span>Size</span>
                    <input
                      onChange={(event) =>
                        updateVariant(index, { sizeLabel: event.target.value })
                      }
                      placeholder="90"
                      required
                      value={variant.sizeLabel}
                    />
                  </label>
                  <label className="admin-form-field">
                    <span>Màu</span>
                    <input
                      onChange={(event) =>
                        updateVariant(index, { colorLabel: event.target.value })
                      }
                      placeholder="Hồng"
                      value={variant.colorLabel}
                    />
                  </label>
                  <label className="admin-form-field">
                    <span>Tình trạng</span>
                    <select
                      onChange={(event) =>
                        updateVariant(index, {
                          stockStatus: event.target.value as StockStatus,
                        })
                      }
                      value={variant.stockStatus}
                    >
                      {stockOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    aria-label={`Xóa size ${variant.sizeLabel || index + 1}`}
                    className="admin-icon-button admin-remove-variant"
                    disabled={form.variants.length === 1}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        variants: current.variants.filter(
                          (_, variantIndex) => variantIndex !== index,
                        ),
                      }))
                    }
                    type="button"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {submitError ? (
            <p className="admin-auth-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <footer className="admin-modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              Hủy
            </button>
            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Đang lưu..." : product ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );

  function updateVariant(
    index: number,
    value: Partial<ProductInput["variants"][number]>,
  ) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...value } : variant,
      ),
    }));
  }
}

function createInitialForm(product: Product | null): ProductInput {
  if (product) {
    return {
      name: product.name,
      description: product.description,
      category: product.category,
      gender: product.gender,
      ageGroup: product.ageGroup,
      weightRange: product.weightRange,
      stockStatus: product.stockStatus,
      isFeatured: product.isFeatured,
      isVisible: product.isVisible,
      variants: product.variants.map((variant) => ({
        sizeLabel: variant.sizeLabel,
        colorLabel: variant.colorLabel,
        stockStatus: variant.stockStatus,
      })),
    };
  }

  return {
    name: "",
    description: "",
    category: "Bộ đồ",
    gender: "unisex",
    ageGroup: "",
    weightRange: "",
    stockStatus: "in_stock",
    isFeatured: false,
    isVisible: true,
    variants: [
      {
        sizeLabel: "",
        colorLabel: "",
        stockStatus: "in_stock",
      },
    ],
  };
}

export default ProductFormModal;
