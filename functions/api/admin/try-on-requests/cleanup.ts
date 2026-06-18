import {
  cleanupExpiredTryOnRequests,
  type TryOnRequestsEnv,
} from "../../../_lib/tryOnRequests";

export const onRequestPost: PagesFunction<TryOnRequestsEnv> = async (context) => {
  const result = await cleanupExpiredTryOnRequests(context.env);

  return Response.json(result);
};
