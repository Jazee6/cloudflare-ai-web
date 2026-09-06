/**
 * Stateless Access Session using HMAC-signed cookies.
 *
 * When APP_PASSWORD is set, protected inference APIs require a valid session cookie.
 * The cookie contains an expiry timestamp and an HMAC-SHA256 proof derived from the password.
 * No raw password or server-side session store is involved; changing APP_PASSWORD
 * immediately invalidates all outstanding tokens.
 */

const COOKIE_NAME = "cf-ai-auth";
const COOKIE_MAX_AGE_DAYS = 30;
const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
const COOKIE_PATH = "/api";

const encoder = new TextEncoder();

const base64urlEncode = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const base64urlDecode = (value: string): Uint8Array | null => {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

const importKey = async (secret: string): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
};

const createProof = async (key: CryptoKey, expiry: number): Promise<string> => {
  const data = encoder.encode(`${expiry}:${COOKIE_NAME}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return base64urlEncode(signature);
};

/**
 * Creates a signed session cookie value: `<expiry>.<proof>`.
 */
export const createSessionToken = async (password: string): Promise<string> => {
  const expiry = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  const key = await importKey(password);
  const proof = await createProof(key, expiry);
  return `${expiry}.${proof}`;
};

/**
 * Verifies a session cookie value against the current password using constant-time comparison.
 * Returns true if the token is valid and not expired.
 */
export const verifySessionToken = async (token: string, password: string): Promise<boolean> => {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const expiry = Number(parts[0]);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const key = await importKey(password);
  const expectedProof = await createProof(key, expiry);
  const providedProof = parts[1];

  const expected = base64urlDecode(expectedProof);
  const provided = base64urlDecode(providedProof);
  if (!expected || !provided || expected.length !== provided.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected[i] ^ provided[i];
  }
  return diff === 0;
};

/** Compares fixed-length digests so the password length is not exposed by an early return. */
export const constantTimeCompare = async (a: string, b: string): Promise<boolean> => {
  const [aDigest, bDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const aBytes = new Uint8Array(aDigest);
  const bBytes = new Uint8Array(bDigest);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
};

export const getAuthCookieName = () => COOKIE_NAME;
export const getAuthCookiePath = () => COOKIE_PATH;
export const getAuthCookieMaxAge = () => COOKIE_MAX_AGE_SECONDS;

/**
 * Builds the Set-Cookie header value for a session cookie.
 */
export const buildCookieHeader = (token: string): string => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=${COOKIE_PATH}; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`;
};

/**
 * Extracts and verifies the session cookie from a request's Cookie header.
 * Returns true if authentication is disabled (no APP_PASSWORD) or the cookie is valid.
 */
export const isRequestAuthorized = async (request: Request): Promise<boolean> => {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    return true;
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) {
    return false;
  }

  const token = cookie.slice(COOKIE_NAME.length + 1);
  return verifySessionToken(token, password);
};
