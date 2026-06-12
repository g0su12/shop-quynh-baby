import {
  deleteProductImage,
  type ProductImagesEnv,
  setPrimaryProductImage,
} from "../../../_lib/productImages";

export const onRequestDelete: PagesFunction<ProductImagesEnv> = async (
  context,
) => {
  const imageId = context.params.id;

  if (typeof imageId !== "string") {
    return Response.json({ message: "Thiếu image id." }, { status: 400 });
  }

  const product = await deleteProductImage(context.env, imageId);

  if (!product) {
    return Response.json({ message: "Không tìm thấy ảnh." }, { status: 404 });
  }

  return Response.json({ product });
};

export const onRequestPatch: PagesFunction<ProductImagesEnv> = async (context) => {
  const imageId = context.params.id;

  if (typeof imageId !== "string") {
    return Response.json({ message: "Thiếu image id." }, { status: 400 });
  }

  let payload: { isPrimary?: unknown };

  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ message: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  if (payload.isPrimary !== true) {
    return Response.json(
      { message: "Trạng thái ảnh đại diện không hợp lệ." },
      { status: 400 },
    );
  }

  const product = await setPrimaryProductImage(context.env, imageId);

  if (!product) {
    return Response.json({ message: "Không tìm thấy ảnh." }, { status: 404 });
  }

  return Response.json({ product });
};
