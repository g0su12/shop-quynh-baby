import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { ImagePlus, Plus, Star, Trash2, X } from "lucide-react";
import type {
  Gender,
  Product,
  ProductInput,
  StockStatus,
} from "../types";
import {
  formatFileSize,
  MAX_SOURCE_IMAGE_BYTES,
  optimizeImageForUpload,
} from "../utils/optimizeImage";

type ProductFormModalProps = {
  product: Product | null;
  isSaving: boolean;
  onClose: () => void;
  onDeleteImage: (imageId: string) => Promise<Product>;
  onSave: (input: ProductInput, imageFiles: File[]) => Promise<void>;
  onSetPrimaryImage: (imageId: string) => Promise<Product>;
};

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
  originalSize: number;
  wasOptimized: boolean;
};

const maxImageCount = 6;
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
  onDeleteImage,
  onSave,
  onSetPrimaryImage,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductInput>(() => createInitialForm(product));
  const [currentImages, setCurrentImages] = useState(product?.images || []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageActionId, setImageActionId] = useState("");
  const [isOptimizingImages, setIsOptimizingImages] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const pendingImagesRef = useRef<PendingImage[]>([]);

  useEffect(() => {
    setForm(createInitialForm(product));
    setCurrentImages(product?.images || []);
    setPendingImages((current) => {
      revokePreviews(current);
      return [];
    });
    setSubmitError("");
  }, [product]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(
    () => () => {
      revokePreviews(pendingImagesRef.current);
    },
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (isOptimizingImages) {
      setSubmitError("Hãy đợi tối ưu ảnh hoàn tất.");
      return;
    }

    try {
      await onSave(
        {
          ...form,
          variants: form.variants.filter((variant) => variant.sizeLabel.trim()),
        },
        pendingImages.map((image) => image.file),
      );
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
            disabled={isSaving || isOptimizingImages}
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

          <section className="admin-image-editor">
            <div className="admin-variant-heading">
              <div>
                <h3>Ảnh sản phẩm</h3>
                <p>
                  Ảnh trên 5 MB sẽ tự giảm kích thước và chuyển sang WebP.
                </p>
              </div>
              <label
                className={`secondary-button admin-image-upload${
                  isOptimizingImages ||
                  currentImages.length + pendingImages.length >= maxImageCount
                    ? " is-disabled"
                    : ""
                }`}
              >
                <ImagePlus aria-hidden="true" />
                <span>{isOptimizingImages ? "Đang tối ưu..." : "Chọn ảnh"}</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  disabled={
                    isOptimizingImages ||
                    currentImages.length + pendingImages.length >= maxImageCount
                  }
                  multiple
                  onChange={handleImageSelection}
                  type="file"
                />
              </label>
            </div>

            {currentImages.length + pendingImages.length > 0 ? (
              <div className="admin-image-grid">
                {currentImages.map((image) => (
                  <article className="admin-image-item" key={image.id}>
                    <img alt={image.altText} src={image.url} />
                    <div className="admin-image-item-footer">
                      {image.isPrimary ? (
                        <span className="admin-primary-image-label">
                          <Star aria-hidden="true" />
                          Đại diện
                        </span>
                      ) : (
                        <button
                          className="admin-image-text-button"
                          disabled={Boolean(imageActionId)}
                          onClick={() => void handleSetPrimaryImage(image.id)}
                          type="button"
                        >
                          <Star aria-hidden="true" />
                          Đặt đại diện
                        </button>
                      )}
                      <button
                        aria-label="Xóa ảnh"
                        className="admin-icon-button admin-image-delete"
                        disabled={Boolean(imageActionId)}
                        onClick={() => void handleDeleteImage(image.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
                {pendingImages.map((image) => (
                  <article className="admin-image-item" key={image.id}>
                    <img
                      alt={`Ảnh chờ tải ${image.file.name}`}
                      src={image.previewUrl}
                    />
                    <div className="admin-image-item-footer">
                      <span className="admin-pending-image-label">
                        {image.wasOptimized
                          ? `${formatFileSize(image.originalSize)} → ${formatFileSize(
                              image.file.size,
                            )}`
                          : `${formatFileSize(image.file.size)} · Chờ tải`}
                      </span>
                      <button
                        aria-label="Bỏ ảnh đã chọn"
                        className="admin-icon-button admin-image-delete"
                        onClick={() => removePendingImage(image.id)}
                        type="button"
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-image-empty">
                <ImagePlus aria-hidden="true" />
                <span>
                  {isOptimizingImages
                    ? "Đang tối ưu ảnh trên thiết bị..."
                    : "Chưa có ảnh sản phẩm."}
                </span>
              </div>
            )}
          </section>

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
            <button
              className="secondary-button"
              disabled={isSaving || isOptimizingImages}
              onClick={onClose}
              type="button"
            >
              Hủy
            </button>
            <button
              className="primary-button"
              disabled={isSaving || isOptimizingImages}
              type="submit"
            >
              {isSaving
                ? "Đang lưu..."
                : isOptimizingImages
                  ? "Đang tối ưu ảnh..."
                  : product
                    ? "Lưu thay đổi"
                    : "Tạo sản phẩm"}
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

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const availableSlots =
      maxImageCount - currentImages.length - pendingImages.length;
    const selectedFiles = Array.from(event.target.files || []).slice(
      0,
      availableSlots,
    );
    event.target.value = "";
    setSubmitError("");

    const validFiles = selectedFiles.filter((file) => {
      return (
        ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
        file.size > 0 &&
        file.size <= MAX_SOURCE_IMAGE_BYTES
      );
    });

    if (validFiles.length !== selectedFiles.length) {
      setSubmitError(
        "Một số ảnh không hợp lệ. Chỉ nhận JPEG, PNG hoặc WebP tối đa 30 MB.",
      );
    }

    if (validFiles.length === 0) {
      return;
    }

    setIsOptimizingImages(true);

    try {
      const optimizedImages: PendingImage[] = [];
      const errors: string[] = [];

      for (const file of validFiles) {
        try {
          const result = await optimizeImageForUpload(file);
          optimizedImages.push({
            id: crypto.randomUUID(),
            file: result.file,
            previewUrl: URL.createObjectURL(result.file),
            originalSize: result.originalSize,
            wasOptimized: result.wasOptimized,
          });
        } catch (error) {
          errors.push(
            error instanceof Error
              ? error.message
              : `Không thể tối ưu ${file.name}.`,
          );
        }
      }

      setPendingImages((current) => [...current, ...optimizedImages]);

      if (errors.length > 0) {
        setSubmitError(errors.join(" "));
      }
    } finally {
      setIsOptimizingImages(false);
    }
  }

  function removePendingImage(id: string) {
    setPendingImages((current) => {
      const removedImage = current.find((image) => image.id === id);

      if (removedImage) {
        URL.revokeObjectURL(removedImage.previewUrl);
      }

      return current.filter((image) => image.id !== id);
    });
  }

  async function handleDeleteImage(imageId: string) {
    if (!window.confirm("Xóa ảnh này khỏi sản phẩm?")) {
      return;
    }

    setImageActionId(imageId);
    setSubmitError("");

    try {
      const updatedProduct = await onDeleteImage(imageId);
      setCurrentImages(updatedProduct.images);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Không thể xóa ảnh.",
      );
    } finally {
      setImageActionId("");
    }
  }

  async function handleSetPrimaryImage(imageId: string) {
    setImageActionId(imageId);
    setSubmitError("");

    try {
      const updatedProduct = await onSetPrimaryImage(imageId);
      setCurrentImages(updatedProduct.images);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Không thể chọn ảnh đại diện.",
      );
    } finally {
      setImageActionId("");
    }
  }
}

function revokePreviews(images: PendingImage[]) {
  for (const image of images) {
    URL.revokeObjectURL(image.previewUrl);
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
