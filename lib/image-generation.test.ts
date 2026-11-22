import { expect, test } from "bun:test";
import {
  createImageRunRequest,
  getImageFailureStatus,
  mapImageFailureResponse,
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

test("createImageRunRequest routes through the gateway with its token and skipCache header", () => {
  const { url, init } = createImageRunRequest({
    ...credentials,
    gateway: { gatewayId: "gw", gatewayToken: "gw-token" },
    model: "@cf/black-forest-labs/flux-2-klein-4b",
    prompt: "apple",
    params: { width: 1024, height: 1024, seed: 7 },
    referenceImages: [{ blob: new Blob([new Uint8Array([1, 2])], { type: "image/jpeg" }) }],
    skipCache: true,
  });

  expect(url).toBe(
    "https://gateway.ai.cloudflare.com/v1/account/gw/workers-ai/run/@cf/black-forest-labs/flux-2-klein-4b",
  );
  expect(init.headers).toEqual({
    Authorization: "Bearer key",
    "cf-aig-authorization": "Bearer gw-token",
    "cf-aig-skip-cache": "true",
  });
  expect(init.body).toBeInstanceOf(FormData);
  const form = init.body as FormData;
  expect(form.get("prompt")).toBe("apple");
  expect(form.get("width")).toBe("1024");
  expect(form.get("height")).toBe("1024");
  expect(form.get("seed")).toBe("7");
  expect(form.get("input_image_0")).toBeInstanceOf(Blob);
});

test("createImageRunRequest maps profile fields for json models", () => {
  const { init } = createImageRunRequest({
    ...credentials,
    model: "@cf/leonardo/phoenix-1.0",
    prompt: "apple",
    params: {
      width: 1344,
      height: 768,
      steps: 20,
      guidance: 2.5,
      seed: 99,
      negativePrompt: "blurry",
    },
  });

  expect(JSON.parse(init.body as string)).toEqual({
    prompt: "apple",
    width: 1344,
    height: 768,
    num_steps: 20,
    guidance: 2.5,
    seed: 99,
    negative_prompt: "blurry",
  });
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

  const jpeg = await toImageResponse(Response.json({ result: { image: "/9j/4AAQ" } }));
  expect(jpeg.headers.get("content-type")).toBe("image/jpeg");

  const dataUrl = await toImageResponse(
    Response.json({ result: { image: "data:image/webp;base64,AQID" } }),
  );
  expect(dataUrl.headers.get("content-type")).toBe("image/webp");
});

test("toImageResponse rejects unsupported payloads", async () => {
  expect((await toImageResponse(Response.json({ images: [] }))).status).toBe(502);
  expect((await toImageResponse(Response.json({ result: { image: "%%%" } }))).status).toBe(502);
});

test("toImageResponse accepts the unwrapped AI Gateway payload", async () => {
  const response = await toImageResponse(Response.json({ image: "AQID" }));
  expect(response.status).toBe(200);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
});

test("mapImageFailureResponse maps Workers Paid 403/5035 and 429 rate limits", async () => {
  const paidRes = await mapImageFailureResponse(
    new Response(JSON.stringify({ errors: [{ code: 5035, message: "Workers Paid required" }] }), {
      status: 403,
    }),
  );
  expect(paidRes.status).toBe(403);
  expect(await paidRes.text()).toContain("Workers Paid");

  const rateRes = await mapImageFailureResponse(new Response("rate limited", { status: 429 }));
  expect(rateRes.status).toBe(429);

  const authRes = await mapImageFailureResponse(new Response("invalid token", { status: 403 }));
  expect(authRes.status).toBe(502);
});
