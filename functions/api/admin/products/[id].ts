import {
  deleteProduct,
  type ProductsEnv,
  updateProduct,
  updateProductVisibility,
  validateProductPayload,
} from "../../../_lib/products";

type AdminProductEnv = ProductsEnv & {
  PRODUCT_IMAGES: R2Bucket;
};

export const onRequestPut: PagesFunction<AdminProductEnv> = async (context) => {
  try {
    const id = context.params.id;

    if (typeof id !== "string") {
      return Response.json({ message: "Thiếu product id." }, { status: 400 });
    }

    const payload = validateProductPayload(await context.request.json());
    const product = await updateProduct(context.env.DB, id, payload);

    if (!product) {
      return Response.json({ message: "Không tìm thấy sản phẩm." }, { status: 404 });
    }

    return Response.json({ product });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Không thể cập nhật sản phẩm.",
      },
      { status: 400 },
    );
  }
};

export const onRequestPatch: PagesFunction<AdminProductEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return Response.json({ message: "Thiếu product id." }, { status: 400 });
  }

  let payload: { isVisible?: unknown };

  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ message: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  if (typeof payload.isVisible !== "boolean") {
    return Response.json(
      { message: "Trạng thái hiển thị không hợp lệ." },
      { status: 400 },
    );
  }

  const product = await updateProductVisibility(
    context.env.DB,
    id,
    payload.isVisible,
  );

  if (!product) {
    return Response.json({ message: "Không tìm thấy sản phẩm." }, { status: 404 });
  }

  return Response.json({ product });
};

export const onRequestDelete: PagesFunction<AdminProductEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return Response.json({ message: "Thiếu product id." }, { status: 400 });
  }

  try {
    const deleted = await deleteProduct(context.env.DB, id);

    if (!deleted) {
      return Response.json({ message: "Không tìm thấy sản phẩm." }, { status: 404 });
    }

    if (deleted.imageKeys.length > 0) {
      await context.env.PRODUCT_IMAGES.delete(deleted.imageKeys);
    }

    return Response.json({
      deletedProductId: deleted.product.id,
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Không thể xóa sản phẩm.",
      },
      { status: 400 },
    );
  }
};
