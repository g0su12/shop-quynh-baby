import {
  ProductImageError,
  type ProductImagesEnv,
  uploadProductImages,
} from "../../../../_lib/productImages";

export const onRequestPost: PagesFunction<ProductImagesEnv> = async (context) => {
  try {
    const productId = context.params.id;

    if (typeof productId !== "string") {
      return Response.json({ message: "Thiếu product id." }, { status: 400 });
    }

    const formData = await context.request.formData();
    const files = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File);
    const product = await uploadProductImages(context.env, productId, files);

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    const status = error instanceof ProductImageError ? error.status : 500;

    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Không thể tải ảnh sản phẩm.",
      },
      { status },
    );
  }
};
