import {
  listTryOnRequests,
  type TryOnRequestsEnv,
} from "../../../_lib/tryOnRequests";

export const onRequestGet: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const requests = await listTryOnRequests(context.env);

  return Response.json({ requests });
};
