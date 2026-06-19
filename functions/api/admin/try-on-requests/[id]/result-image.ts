import {
  getTryOnRequestResultImage,
  TryOnRequestError,
  uploadTryOnRequestResultImage,
  type TryOnRequestsEnv,
} from "../../../../_lib/tryOnRequests";

export const onRequestGet: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return new Response("Missing request id.", { status: 400 });
  }

  const image = await getTryOnRequestResultImage(context.env, id);

  if (!image) {
    return new Response("Not found.", { status: 404 });
  }

  return image;
};

export const onRequestPost: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return Response.json({ message: "Thiếu request id." }, { status: 400 });
  }

  try {
    const formData = await context.request.formData();
    const request = await uploadTryOnRequestResultImage(
      context.env,
      id,
      formData,
    );

    return Response.json({ request });
  } catch (error) {
    if (error instanceof TryOnRequestError) {
      return Response.json({ message: error.message }, { status: error.status });
    }

    return Response.json(
      { message: "Không thể lưu ảnh kết quả thử đồ." },
      { status: 400 },
    );
  }
};
