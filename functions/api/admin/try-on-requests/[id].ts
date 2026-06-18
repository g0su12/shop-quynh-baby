import {
  TryOnRequestError,
  updateTryOnRequestStatus,
  type TryOnRequestsEnv,
} from "../../../_lib/tryOnRequests";

export const onRequestPatch: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return Response.json({ message: "Thiếu request id." }, { status: 400 });
  }

  try {
    const payload = (await context.request.json()) as {
      adminNote?: string;
      status?: unknown;
    };
    const request = await updateTryOnRequestStatus(
      context.env,
      id,
      payload.status,
      payload.adminNote || "",
    );

    if (!request) {
      return Response.json(
        { message: "Không tìm thấy yêu cầu thử đồ." },
        { status: 404 },
      );
    }

    return Response.json({ request });
  } catch (error) {
    if (error instanceof TryOnRequestError) {
      return Response.json({ message: error.message }, { status: error.status });
    }

    return Response.json(
      { message: "Không thể cập nhật yêu cầu thử đồ." },
      { status: 400 },
    );
  }
};
