import {
  createAdminSessionCookie,
  type AdminAuthEnv,
  verifyAdminPassword,
} from "../../_lib/adminAuth";

export const onRequestPost: PagesFunction<AdminAuthEnv> = async (context) => {
  if (!context.env.ADMIN_PASSWORD_HASH || !context.env.ADMIN_SESSION_SECRET) {
    return Response.json(
      {
        ok: false,
        message: "Admin auth is not configured.",
      },
      { status: 503 },
    );
  }

  let payload: { password?: string };

  try {
    payload = await context.request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        message: "Invalid login request.",
      },
      { status: 400 },
    );
  }

  if (!payload.password) {
    return Response.json(
      {
        ok: false,
        message: "Password is required.",
      },
      { status: 400 },
    );
  }

  const isValidPassword = await verifyAdminPassword(
    payload.password,
    context.env.ADMIN_PASSWORD_HASH,
  );

  if (!isValidPassword) {
    return Response.json(
      {
        ok: false,
        message: "Invalid password.",
      },
      { status: 401 },
    );
  }

  const requestUrl = new URL(context.request.url);
  const useSecureCookie = requestUrl.protocol === "https:";

  return Response.json(
    {
      ok: true,
    },
    {
      headers: {
        "Set-Cookie": await createAdminSessionCookie(
          context.env.ADMIN_SESSION_SECRET,
          useSecureCookie,
        ),
      },
    },
  );
};
