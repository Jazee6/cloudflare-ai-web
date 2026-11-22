import { expect, mock, test } from "bun:test";
import {
  assertSafePublicUrl,
  isPrivateOrReservedIp,
  safeFetchUrl,
  SsrfError,
  validatePublicUrl,
} from "@/lib/ssrf";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

test("validatePublicUrl blocks non-http protocols, credentials, non-standard ports, and local hostnames", () => {
  expect(() => validatePublicUrl("file:///etc/passwd")).toThrow(SsrfError);
  expect(() => validatePublicUrl("ftp://example.com/file")).toThrow(SsrfError);
  expect(() => validatePublicUrl("https://user:pass@example.com")).toThrow(SsrfError);
  expect(() => validatePublicUrl("https://example.com:8443/api")).toThrow(SsrfError);
  expect(() => validatePublicUrl("http://localhost/admin")).toThrow(SsrfError);
  expect(() => validatePublicUrl("http://service.internal/health")).toThrow(SsrfError);
  expect(() => validatePublicUrl("http://metadata.google.internal/computeMetadata/v1")).toThrow(
    SsrfError,
  );
  expect(validatePublicUrl("https://example.com:443/docs").hostname).toBe("example.com");
});

test("isPrivateOrReservedIp blocks IPv4 and IPv6 loopback, private, metadata, and mapped ranges", () => {
  const blocked = [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.5",
    "0.0.0.0",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:7f00:1",
  ];
  for (const ip of blocked) {
    expect(isPrivateOrReservedIp(ip)).toBe(true);
  }

  expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);
  expect(isPrivateOrReservedIp("2606:4700:4700::1111")).toBe(false);
});

test("assertSafePublicUrl blocks DNS responses that contain any private IP", async () => {
  await expect(
    assertSafePublicUrl("https://dual.example.com", {
      lookup: async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ],
    }),
  ).rejects.toMatchObject({ status: 403 });

  const safe = await assertSafePublicUrl("https://example.com/guide", { lookup: publicLookup });
  expect(safe.hostname).toBe("example.com");
});

test("safeFetchUrl validates redirects and blocks redirect to metadata endpoint", async () => {
  const fetchMock = mock(async () => {
    return new Response(null, {
      status: 302,
      headers: { Location: "http://169.254.169.254/latest/meta-data/" },
    });
  }) as unknown as typeof fetch;

  await expect(
    safeFetchUrl("https://example.com/start", {
      fetchImpl: fetchMock,
      lookup: publicLookup,
    }),
  ).rejects.toMatchObject({ status: 403 });
});

test("safeFetchUrl rejects redirect chains deeper than 3 hops", async () => {
  let hop = 0;
  const fetchMock = mock(async () => {
    hop++;
    return new Response(null, {
      status: 302,
      headers: { Location: `https://example.com/hop-${hop}` },
    });
  }) as unknown as typeof fetch;

  await expect(
    safeFetchUrl("https://example.com/hop-0", {
      fetchImpl: fetchMock,
      lookup: publicLookup,
    }),
  ).rejects.toMatchObject({ status: 400 });
});

test("safeFetchUrl aborts streaming responses exceeding maxBytes", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(600));
      controller.enqueue(new Uint8Array(600));
      controller.close();
    },
  });

  const fetchMock = mock(async () => {
    return new Response(stream, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;

  await expect(
    safeFetchUrl("https://example.com/large", {
      maxBytes: 1000,
      fetchImpl: fetchMock,
      lookup: publicLookup,
    }),
  ).rejects.toMatchObject({ status: 413 });
});
