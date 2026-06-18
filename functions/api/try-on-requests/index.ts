import {
  createTryOnRequest,
  TryOnRequestError,
  type TryOnRequestsEnv,
} from "../../_lib/tryOnRequests";

export const onRequestPost: PagesFunction<TryOnRequestsEnv> = async (context) => {
  try {
    const formData = await context.request.formData();
    const request = await createTryOnRequest(context.env, formData);

    return Response.json({ request }, { status: 201 });
  } catch (error) {
    if (error instanceof TryOnRequestError) {
      return Response.json({ message: error.message }, { status: error.status });
    }

    console.error("[try-on-request]", error);
    return Response.json(
      { message: "Không thể gửi yêu cầu thử đồ." },
      { status: 500 },
    );
  }
};
