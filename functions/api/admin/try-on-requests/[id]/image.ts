import {
  getTryOnRequestInputImage,
  type TryOnRequestsEnv,
} from "../../../../_lib/tryOnRequests";

export const onRequestGet: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const id = context.params.id;

  if (typeof id !== "string") {
    return new Response("Missing request id.", { status: 400 });
  }

  const image = await getTryOnRequestInputImage(context.env, id);

  if (!image) {
    return new Response("Not found.", { status: 404 });
  }

  return image;
};
