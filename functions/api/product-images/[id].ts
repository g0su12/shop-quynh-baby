import {
  getProductImage,
  type ProductImagesEnv,
} from "../../_lib/productImages";

export const onRequestGet: PagesFunction<ProductImagesEnv> = async (context) => {
  const imageId = context.params.id;

  if (typeof imageId !== "string") {
    return new Response("Missing image id.", { status: 400 });
  }

  const response = await getProductImage(context.env, imageId);

  return response || new Response("Image not found.", { status: 404 });
};
