import { isAdminRequest, type AdminAuthEnv } from "./_lib/adminAuth";

export const onRequest: PagesFunction<AdminAuthEnv> = async (context) => {
  const url = new URL(context.request.url);
  const isAdminPage = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  const isLoginPage = url.pathname === "/admin/login";

  if (!isAdminPage || isLoginPage) {
    return context.next();
  }

  const isAuthenticated = await isAdminRequest(
    context.request,
    context.env.ADMIN_SESSION_SECRET,
  );

  if (isAuthenticated) {
    return context.next();
  }

  const loginUrl = new URL("/admin/login", url.origin);
  loginUrl.searchParams.set("next", url.pathname);

  return Response.redirect(loginUrl, 302);
};
