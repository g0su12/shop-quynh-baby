import {
  createAdminSessionCookie,
  type AdminAuthEnv,
  verifyAdminPasswordWithDiagnostics,
} from "../../_lib/adminAuth";

const supportedPbkdf2Iterations = 100_000;

export const onRequestPost: PagesFunction<AdminAuthEnv> = async (context) => {
  const isDebugEnabled = isAdminAuthDebugEnabled(context.env.ADMIN_AUTH_DEBUG);

  if (!context.env.ADMIN_PASSWORD_HASH || !context.env.ADMIN_SESSION_SECRET) {
    const hostname = new URL(context.request.url).hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    logAdminAuth("warn", "admin_login_misconfigured", context, {
      hasPasswordHash: Boolean(context.env.ADMIN_PASSWORD_HASH),
      hasSessionSecret: Boolean(context.env.ADMIN_SESSION_SECRET),
      passwordHash: await summarizePasswordHash(
        context.env.ADMIN_PASSWORD_HASH,
        isDebugEnabled,
      ),
    });

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

  if (isDebugEnabled) {
    logAdminAuth("info", "admin_login_attempt", context, {
      passwordHash: await summarizePasswordHash(
        context.env.ADMIN_PASSWORD_HASH,
        true,
      ),
      hasSessionSecret: Boolean(context.env.ADMIN_SESSION_SECRET),
    });
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

  const verification = await verifyAdminPasswordWithDiagnostics(
    payload.password,
    context.env.ADMIN_PASSWORD_HASH,
  );

  if (!verification.ok) {
    logAdminAuth("warn", "admin_login_failed", context, {
      reason: "invalid_password_or_password_hash",
      verification,
      passwordHash: await summarizePasswordHash(
        context.env.ADMIN_PASSWORD_HASH,
        isDebugEnabled,
      ),
      passwordInput: isDebugEnabled
        ? summarizePasswordInput(payload.password)
        : undefined,
      hasSessionSecret: Boolean(context.env.ADMIN_SESSION_SECRET),
    });

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

  if (isDebugEnabled) {
    logAdminAuth("info", "admin_login_success", context, {
      useSecureCookie,
      verification,
      passwordHash: await summarizePasswordHash(
        context.env.ADMIN_PASSWORD_HASH,
        true,
      ),
      passwordInput: summarizePasswordInput(payload.password),
      hasSessionSecret: Boolean(context.env.ADMIN_SESSION_SECRET),
    });
  }

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

function isAdminAuthDebugEnabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

function logAdminAuth(
  level: "info" | "warn",
  event: string,
  context: EventContext<AdminAuthEnv, string, unknown>,
  details: Record<string, unknown>,
) {
  const requestUrl = new URL(context.request.url);

  console[level](
    `[admin-auth] ${JSON.stringify({
      event,
      hostname: requestUrl.hostname,
      protocol: requestUrl.protocol,
      method: context.request.method,
      ...details,
    })}`,
  );
}

async function summarizePasswordHash(
  storedHash: string | undefined,
  includeDebugFingerprint = false,
) {
  if (!storedHash) {
    return {
      configured: false,
    };
  }

  const trimmedHash = storedHash.trim();
  const parts = storedHash.split("$");
  const iterations = Number(parts[1]);
  const quoteWrapped =
    (storedHash.startsWith('"') && storedHash.endsWith('"')) ||
    (storedHash.startsWith("'") && storedHash.endsWith("'")) ||
    (storedHash.startsWith("`") && storedHash.endsWith("`"));

  const summary = {
    configured: true,
    length: storedHash.length,
    trimmedLength: trimmedHash.length,
    hasOuterWhitespace: storedHash !== trimmedHash,
    containsWhitespace: /\s/.test(storedHash),
    quoteWrapped,
    segmentCount: parts.length,
    algorithmOk: parts[0] === "pbkdf2_sha256",
    algorithmLength: parts[0]?.length || 0,
    iterations,
    iterationsOk:
      Number.isInteger(iterations) &&
      iterations === supportedPbkdf2Iterations,
    supportedIterations: supportedPbkdf2Iterations,
    saltLength: parts[2]?.length || 0,
    hashLength: parts[3]?.length || 0,
    extraSegmentCount: Math.max(parts.length - 4, 0),
  };

  return includeDebugFingerprint
    ? {
        ...summary,
        debugFingerprint: await createDebugFingerprint(storedHash),
      }
    : summary;
}

function summarizePasswordInput(password: string) {
  const trimmedPassword = password.trim();

  return {
    length: password.length,
    trimmedLength: trimmedPassword.length,
    utf8ByteLength: new TextEncoder().encode(password).byteLength,
    codePointCount: [...password].length,
    hasOuterWhitespace: password !== trimmedPassword,
    containsWhitespace: /\s/.test(password),
    hasNonAscii: /[^\x00-\x7F]/.test(password),
  };
}

async function createDebugFingerprint(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
