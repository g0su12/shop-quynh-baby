import {
  createAdminSessionCookie,
  type AdminAuthEnv,
  verifyAdminPassword,
} from "../../_lib/adminAuth";

export const onRequestPost: PagesFunction<AdminAuthEnv> = async (context) => {
  if (!context.env.ADMIN_PASSWORD_HASH || !context.env.ADMIN_SESSION_SECRET) {
    const hostname = new URL(context.request.url).hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    return Response.json(
      {
        ok: false,
        message: isLocal
          ? "Admin local chưa được cấu hình. Chạy `npm run admin:setup:local`, sau đó khởi động lại `npm run cf:dev`."
          : "Admin auth chưa được cấu hình. Kiểm tra ADMIN_PASSWORD_HASH và ADMIN_SESSION_SECRET trong Worker secrets.",
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
        message: "Dữ liệu đăng nhập không hợp lệ.",
      },
      { status: 400 },
    );
  }

  if (!payload.password) {
    return Response.json(
      {
        ok: false,
        message: "Vui lòng nhập mật khẩu admin.",
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
        message: "Mật khẩu admin không đúng hoặc ADMIN_PASSWORD_HASH đang cấu hình sai.",
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
