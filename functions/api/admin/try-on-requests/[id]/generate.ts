import {
  generateTryOnRequestResultImage,
  TryOnRequestError,
  type TryOnRequestsEnv,
} from "../../../../_lib/tryOnRequests";

export const onRequestPost: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return Response.json({ message: "Thiếu request id." }, { status: 400 });
  }

  try {
    const request = await generateTryOnRequestResultImage(context.env, id);

    return Response.json({ request });
  } catch (error) {
    if (error instanceof TryOnRequestError) {
      return Response.json({ message: error.message }, { status: error.status });
    }

    return Response.json(
      { message: "Không thể tạo ảnh thử đồ bằng AI." },
      { status: 500 },
    );
  }
};
