import { isAdminRequest, type AdminAuthEnv } from "../../_lib/adminAuth";

export const onRequestGet: PagesFunction<AdminAuthEnv> = async (context) => {
  const authenticated = await isAdminRequest(
    context.request,
    context.env.ADMIN_SESSION_SECRET,
  );

  return Response.json({
    authenticated,
  });
};
