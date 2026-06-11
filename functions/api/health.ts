type Env = {
  DB: D1Database;
  PRODUCT_IMAGES: R2Bucket;
  TRY_ON_IMAGES: R2Bucket;
};

export const onRequestGet: PagesFunction<Env> = async () => {
  return Response.json({
    ok: true,
    service: "quynh-baby-shop",
    timestamp: new Date().toISOString(),
  });
};
