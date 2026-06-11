import {
  createProduct,
  listProducts,
  type ProductsEnv,
  validateProductPayload,
} from "../../../_lib/products";

export const onRequestGet: PagesFunction<ProductsEnv> = async (context) => {
  const products = await listProducts(context.env.DB, true);

  return Response.json({ products });
};

export const onRequestPost: PagesFunction<ProductsEnv> = async (context) => {
  try {
    const payload = validateProductPayload(await context.request.json());
    const product = await createProduct(context.env.DB, payload);

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Không thể tạo sản phẩm.",
      },
      { status: 400 },
    );
  }
};
