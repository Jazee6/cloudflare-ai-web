import { isIP } from "node:net";
import * as v from "valibot";
import { MAX_DOCUMENT_BYTES } from "@/lib/context-attachments";

export const SSRF_FETCH_TIMEOUT_MS = 10_000;
export const SSRF_MAX_REDIRECTS = 3;
export const SSRF_MAX_RESPONSE_BYTES = MAX_DOCUMENT_BYTES;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata.goog",
]);

export class SsrfError extends Error {
  readonly status: 400 | 403 | 413 | 502 | 504;

  constructor(message: string, status: 400 | 403 | 413 | 502 | 504) {
    super(message);
    this.name = "SsrfError";
    this.status = status;
  }
}

export type DnsLookupResult = { address: string; family?: number };
export type DnsLookupFn = (hostname: string) => Promise<DnsLookupResult[]>;

const dohResponseSchema = v.object({
  Status: v.optional(v.number()),
  Answer: v.optional(
    v.array(
      v.object({
        type: v.number(),
        data: v.string(),
      }),
    ),
  ),
});

const normalizeHostname = (hostname: string): string => {
  const lower = hostname.trim().toLowerCase();
  const unbracketed = lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
  return unbracketed.replace(/\.+$/, "");
};

const parseIpv4 = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return null;
    }
    value = ((value << 8) | octet) >>> 0;
  }
  return value;
};

const ipv4InCidr = (ipNum: number, base: string, prefixLen: number): boolean => {
  const baseNum = parseIpv4(base);
  if (baseNum === null) {
    return false;
  }
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
};

const BLOCKED_IPV4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const isBlockedIpv4Number = (ipNum: number): boolean =>
  BLOCKED_IPV4_CIDRS.some(([base, prefix]) => ipv4InCidr(ipNum, base, prefix));

const expandIpv6 = (raw: string): number[] | null => {
  const zoneIndex = raw.indexOf("%");
  const withoutZone = zoneIndex === -1 ? raw : raw.slice(0, zoneIndex);
  const lower = withoutZone.toLowerCase();

  const doubleColonParts = lower.split("::");
  if (doubleColonParts.length > 2) {
    return null;
  }

  const parseSide = (side: string): number[] | null => {
    if (!side) {
      return [];
    }
    const tokens = side.split(":");
    const hextets: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.includes(".")) {
        if (i !== tokens.length - 1) {
          return null;
        }
        const ipv4 = parseIpv4(token);
        if (ipv4 === null) {
          return null;
        }
        hextets.push((ipv4 >>> 16) & 0xffff, ipv4 & 0xffff);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(token)) {
          return null;
        }
        hextets.push(Number.parseInt(token, 16));
      }
    }
    return hextets;
  };

  if (doubleColonParts.length === 1) {
    const groups = parseSide(doubleColonParts[0]);
    return groups && groups.length === 8 ? groups : null;
  }

  const left = parseSide(doubleColonParts[0]);
  const right = parseSide(doubleColonParts[1]);
  if (!left || !right) {
    return null;
  }
  const missing = 8 - (left.length + right.length);
  if (missing < 1) {
    return null;
  }
  return [...left, ...Array<number>(missing).fill(0), ...right];
};

const ipv6MatchesPrefix = (
  groups: number[],
  prefixGroups: number[],
  prefixBits: number,
): boolean => {
  let remaining = prefixBits;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const bits = Math.min(16, remaining);
    const mask = (0xffff << (16 - bits)) & 0xffff;
    if ((groups[i] & mask) !== ((prefixGroups[i] ?? 0) & mask)) {
      return false;
    }
    remaining -= bits;
  }
  return true;
};

/** Returns true when an IPv4 or IPv6 literal belongs to a private, loopback, link-local, or reserved range. */
export const isPrivateOrReservedIp = (rawIp: string): boolean => {
  const normalized = normalizeHostname(rawIp);
  const ipv4Num = parseIpv4(normalized);
  if (ipv4Num !== null) {
    return isBlockedIpv4Number(ipv4Num);
  }

  const ipv6 = expandIpv6(normalized);
  if (!ipv6) {
    // Fail closed on unparseable IP strings.
    return true;
  }

  // Unspecified ::/128 or loopback ::1/128
  if (
    ipv6MatchesPrefix(ipv6, [0, 0, 0, 0, 0, 0, 0, 0], 128) ||
    ipv6MatchesPrefix(ipv6, [0, 0, 0, 0, 0, 0, 0, 1], 128)
  ) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96, IPv4-translated ::ffff:0:0:0/96, or IPv4-compatible ::/96
  if (
    ipv6MatchesPrefix(ipv6, [0, 0, 0, 0, 0, 0xffff], 96) ||
    ipv6MatchesPrefix(ipv6, [0, 0, 0, 0, 0xffff, 0], 96) ||
    ipv6MatchesPrefix(ipv6, [0, 0, 0, 0, 0, 0], 96)
  ) {
    const embeddedIpv4 = ((ipv6[6] << 16) | ipv6[7]) >>> 0;
    return isBlockedIpv4Number(embeddedIpv4);
  }

  // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (
    ipv6MatchesPrefix(ipv6, [0x0064, 0xff9b, 0, 0, 0, 0], 96) ||
    ipv6MatchesPrefix(ipv6, [0x0064, 0xff9b, 0x0001], 48)
  ) {
    return true;
  }

  // Discard 100::/64, 6to4 2002::/16, Documentation 2001:db8::/32, ULA fc00::/7, Link-local fe80::/10, Site-local fec0::/10, Multicast ff00::/8
  if (
    ipv6MatchesPrefix(ipv6, [0x0100, 0, 0, 0], 64) ||
    ipv6MatchesPrefix(ipv6, [0x2002], 16) ||
    ipv6MatchesPrefix(ipv6, [0x2001, 0x0db8], 32) ||
    ipv6MatchesPrefix(ipv6, [0xfc00], 7) ||
    ipv6MatchesPrefix(ipv6, [0xfe80], 10) ||
    ipv6MatchesPrefix(ipv6, [0xfec0], 10) ||
    ipv6MatchesPrefix(ipv6, [0xff00], 8)
  ) {
    return true;
  }

  return false;
};

/** Validates URL syntax, protocol, absence of embedded credentials, standard ports, and public hostname. */
export const validatePublicUrl = (rawUrl: string): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new SsrfError("Invalid URL.", 400);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfError("Only http and https URLs are allowed.", 400);
  }

  if (url.username || url.password) {
    throw new SsrfError("URLs containing credentials are not allowed.", 400);
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SsrfError("Only standard HTTP/HTTPS ports (80, 443) are allowed.", 403);
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) {
    throw new SsrfError("Invalid URL hostname.", 400);
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new SsrfError("Access to local or internal hosts is not allowed.", 403);
  }

  return url;
};

const queryCloudflareDoh = async (
  hostname: string,
  recordType: "A" | "AAAA",
): Promise<DnsLookupResult[]> => {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", recordType);

  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new SsrfError("Unable to resolve target hostname.", 400);
  }

  const parsed = v.safeParse(dohResponseSchema, await response.json());
  if (!parsed.success || !parsed.output.Answer) {
    return [];
  }

  const expectedType = recordType === "A" ? 1 : 28;
  return parsed.output.Answer.filter(
    (answer) => answer.type === expectedType && isIP(answer.data) > 0,
  ).map((answer) => ({ address: answer.data }));
};

const defaultDnsLookup: DnsLookupFn = async (hostname) => {
  try {
    const { lookup } = await import("node:dns/promises");
    return await lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    // Workers without node:dns support fall back to Cloudflare DoH; ENOTFOUND/EAI_NONAME fail closed.
    if (code === "ENOTFOUND" || code === "EAI_NONAME" || code === "EAI_AGAIN") {
      throw new SsrfError("Target hostname could not be resolved.", 400);
    }
    const [aRecords, aaaaRecords] = await Promise.all([
      queryCloudflareDoh(hostname, "A"),
      queryCloudflareDoh(hostname, "AAAA"),
    ]);
    return [...aRecords, ...aaaaRecords];
  }
};

/** Validates a URL and confirms every resolved IP address is public before making any request. */
export const assertSafePublicUrl = async (
  rawUrl: string,
  options?: { lookup?: DnsLookupFn },
): Promise<URL> => {
  const url = validatePublicUrl(rawUrl);
  const hostname = normalizeHostname(url.hostname);

  if (isIP(hostname) > 0 || parseIpv4(hostname) !== null || hostname.includes(":")) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new SsrfError("Access to private or reserved IP addresses is not allowed.", 403);
    }
    return url;
  }

  const lookup = options?.lookup ?? defaultDnsLookup;
  let records: DnsLookupResult[];
  try {
    records = await lookup(hostname);
  } catch (error) {
    if (error instanceof SsrfError) {
      throw error;
    }
    throw new SsrfError("Target hostname could not be resolved.", 400);
  }

  if (records.length === 0) {
    throw new SsrfError("Target hostname could not be resolved.", 400);
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new SsrfError("Target hostname resolves to a private or reserved IP address.", 403);
    }
  }

  return url;
};

const readBoundedResponseBytes = async (
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel();
    throw new SsrfError("Target webpage exceeds the 4 MiB size limit.", 413);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new SsrfError("Target webpage exceeds the 4 MiB size limit.", 413);
    }
    return buffer;
  }

  let totalBytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new SsrfError("Target webpage exceeds the 4 MiB size limit.", 413);
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
};

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  headers: Headers;
  bytes: Uint8Array;
}

/** Fetches a public URL with DNS validation on every hop, manual redirect checks, timeout, and size cap. */
export const safeFetchUrl = async (
  rawUrl: string,
  options?: {
    headers?: HeadersInit;
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
    fetchImpl?: typeof fetch;
    lookup?: DnsLookupFn;
  },
): Promise<SafeFetchResult> => {
  const maxBytes = options?.maxBytes ?? SSRF_MAX_RESPONSE_BYTES;
  const timeoutMs = options?.timeoutMs ?? SSRF_FETCH_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? SSRF_MAX_REDIRECTS;
  const fetchImpl = options?.fetchImpl ?? fetch;

  let currentUrl = (await assertSafePublicUrl(rawUrl, { lookup: options?.lookup })).toString();
  const deadlineSignal = AbortSignal.timeout(timeoutMs);

  for (let redirects = 0; ; redirects++) {
    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        headers: options?.headers,
        redirect: "manual",
        signal: deadlineSignal,
      });
    } catch (error) {
      if (deadlineSignal.aborted || (error as Error | undefined)?.name === "TimeoutError") {
        throw new SsrfError("Timed out while fetching the target URL.", 504);
      }
      throw new SsrfError("Failed to fetch the target URL.", 502);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) {
        throw new SsrfError("Invalid redirect response from target URL.", 400);
      }
      if (redirects >= maxRedirects) {
        throw new SsrfError("Target URL exceeded the maximum number of redirects.", 400);
      }

      let nextUrl: string;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new SsrfError("Invalid redirect location from target URL.", 400);
      }
      currentUrl = (await assertSafePublicUrl(nextUrl, { lookup: options?.lookup })).toString();
      continue;
    }

    let bytes: Uint8Array;
    try {
      bytes = await readBoundedResponseBytes(response, maxBytes);
    } catch (error) {
      if (error instanceof SsrfError) {
        throw error;
      }
      if (deadlineSignal.aborted || (error as Error | undefined)?.name === "TimeoutError") {
        throw new SsrfError("Timed out while reading the target URL.", 504);
      }
      throw new SsrfError("Failed to read the target URL response.", 502);
    }
    const contentType =
      response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";

    return {
      finalUrl: currentUrl,
      status: response.status,
      contentType,
      headers: response.headers,
      bytes,
    };
  }
};
