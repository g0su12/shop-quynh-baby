import { getProductBySlug, type ProductsEnv } from "../../_lib/products";

export const onRequestGet: PagesFunction<ProductsEnv> = async (context) => {
  const slug = getParam(context.params.slug);

  if (!slug) {
    return Response.json({ message: "Không tìm thấy sản phẩm." }, { status: 404 });
  }

  const product = await getProductBySlug(context.env.DB, slug, false);

  if (!product) {
    return Response.json({ message: "Không tìm thấy sản phẩm." }, { status: 404 });
  }

  return Response.json(
    { product },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
