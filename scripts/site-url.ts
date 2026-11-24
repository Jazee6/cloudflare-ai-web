/**
 * Normalizes the optional build-time `SITE_URL` to an origin plus path without a trailing slash.
 * Unset or blank means the deployment's address is unknown; anything else must be http(s).
 */
export function resolveSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env.SITE_URL?.trim();
  if (!raw) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `Invalid SITE_URL "${raw}". Use an absolute URL such as https://ai.example.com.`,
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Invalid SITE_URL "${raw}". Use an http(s) URL.`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
