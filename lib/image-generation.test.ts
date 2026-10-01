import { expect, test } from "bun:test";
import {
  createImageRunRequest,
  getImageFailureStatus,
  toImageResponse,
} from "@/lib/image-generation";

const credentials = { accountId: "account", apiKey: "key" };

test("createImageRunRequest targets the REST API without a gateway", () => {
  const { url, init } = createImageRunRequest({
    ...credentials,
    model: "@cf/black-forest-labs/flux-1-schnell",
    prompt: "apple",
  });

  expect(url).toBe(
    "https://api.cloudflare.com/client/v4/accounts/account/ai/run/@cf/black-forest-labs/flux-1-schnell",
  );
  expect(init.headers).toEqual({
    Authorization: "Bearer key",
    "Content-Type": "application/json",
  });
  expect(init.body).toBe(JSON.stringify({ prompt: "apple" }));
});

test("createImageRunRequest routes through the gateway with its token", () => {
  const { url, init } = createImageRunRequest({
    ...credentials,
    gateway: { gatewayId: "gw", gatewayToken: "gw-token" },
    model: "@cf/black-forest-labs/flux-2-klein-4b",
    prompt: "apple",
  });

  expect(url).toBe(
    "https://gateway.ai.cloudflare.com/v1/account/gw/workers-ai/run/@cf/black-forest-labs/flux-2-klein-4b",
  );
  expect(init.headers).toEqual({
    Authorization: "Bearer key",
    "cf-aig-authorization": "Bearer gw-token",
  });
  expect(init.body).toBeInstanceOf(FormData);
});

test("getImageFailureStatus reports credential rejections as server errors", () => {
  expect(getImageFailureStatus(401)).toBe(502);
  expect(getImageFailureStatus(403)).toBe(502);
  expect(getImageFailureStatus(429)).toBe(429);
  expect(getImageFailureStatus(422)).toBe(400);
  expect(getImageFailureStatus(500)).toBe(502);
});

test("toImageResponse passes binary images through", async () => {
  const response = await toImageResponse(
    new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
  );

  expect(response.headers.get("content-type")).toBe("image/jpeg");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

test("toImageResponse decodes JSON-wrapped base64 and data URLs", async () => {
  const plain = await toImageResponse(Response.json({ result: { image: "AQID" } }));
  expect(plain.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await plain.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

  const dataUrl = await toImageResponse(
    Response.json({ result: { image: "data:image/webp;base64,AQID" } }),
  );
  expect(dataUrl.headers.get("content-type")).toBe("image/webp");
});

test("toImageResponse rejects unsupported payloads", async () => {
  expect((await toImageResponse(Response.json({ images: [] }))).status).toBe(502);
  expect((await toImageResponse(Response.json({ result: { image: "%%%" } }))).status).toBe(502);
});
