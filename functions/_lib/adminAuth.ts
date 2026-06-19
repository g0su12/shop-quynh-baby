const COOKIE_NAME = "qbs_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

export type AdminAuthEnv = {
  ADMIN_AUTH_DEBUG?: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
};

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export async function verifyAdminPassword(password: string, storedHash: string) {
  const result = await verifyAdminPasswordWithDiagnostics(password, storedHash);

  return result.ok;
}

export async function verifyAdminPasswordWithDiagnostics(
  password: string,
  storedHash: string,
) {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split("$");

  if (algorithm !== "pbkdf2_sha256") {
    return {
      ok: false,
      reason: "unsupported_algorithm",
    };
  }

  const iterations = Number(iterationsText);

  if (
    !Number.isInteger(iterations) ||
    iterations !== PBKDF2_ITERATIONS ||
    !saltText ||
    !hashText
  ) {
    return {
      ok: false,
      reason: "invalid_or_unsupported_hash_metadata",
      expectedIterations: PBKDF2_ITERATIONS,
    };
  }

  try {
    const salt = base64UrlToBytes(saltText);
    const expectedHash = base64UrlToBytes(hashText);
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations,
      },
      passwordKey,
      expectedHash.byteLength * 8,
    );
    const ok = timingSafeEqual(new Uint8Array(derivedBits), expectedHash);

    return {
      ok,
      reason: ok ? "matched" : "hash_mismatch",
      expectedHashBytes: expectedHash.byteLength,
      derivedHashBytes: derivedBits.byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "verification_error",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createAdminSessionCookie(secret: string, secure = true) {
  const now = Math.floor(Date.now() / 1000);
  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        sub: "admin",
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
      }),
    ),
  );
  const signature = await signValue(payload, secret);
  const secureAttribute = secure ? "; Secure" : "";

  return `${COOKIE_NAME}=${payload}.${signature}; HttpOnly${secureAttribute}; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearAdminSessionCookie(secure = true) {
  const secureAttribute = secure ? "; Secure" : "";

  return `${COOKIE_NAME}=; HttpOnly${secureAttribute}; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function isAdminRequest(request: Request, secret?: string) {
  if (!secret) {
    return false;
  }

  const session = getCookie(request, COOKIE_NAME);

  if (!session) {
    return false;
  }

  const [payload, signature] = session.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = await signValue(payload, secret);

  if (!timingSafeStringEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const decodedPayload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as {
      exp?: number;
      sub?: string;
    };

    return decodedPayload.sub === "admin" && Number(decodedPayload.exp) > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return bytesToBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.byteLength; index += 1) {
    result |= left[index] ^ right[index];
  }

  return result === 0;
}

function timingSafeStringEqual(left: string, right: string) {
  return timingSafeEqual(encoder.encode(left), encoder.encode(right));
}
