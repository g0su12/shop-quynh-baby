import { clearAdminSessionCookie } from "../../_lib/adminAuth";

export const onRequestPost: PagesFunction = async (context) => {
  const requestUrl = new URL(context.request.url);
  const useSecureCookie = requestUrl.protocol === "https:";

  return Response.json(
    {
      ok: true,
    },
    {
      headers: {
        "Set-Cookie": clearAdminSessionCookie(useSecureCookie),
      },
    },
  );
};
