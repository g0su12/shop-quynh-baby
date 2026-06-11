import { listProducts, type ProductsEnv } from "../_lib/products";

export const onRequestGet: PagesFunction<ProductsEnv> = async (context) => {
  const products = await listProducts(context.env.DB, false);

  return Response.json(
    { products },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
};
