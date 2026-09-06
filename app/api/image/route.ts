import * as v from "valibot";
import { getCatalogModel } from "@/lib/model-catalog";

const schema = v.object({
  prompt: v.pipe(v.string(), v.trim(), v.minLength(1)),
  model: v.pipe(v.string(), v.minLength(1)),
});

const imageResponseSchema = v.object({
  result: v.object({
    image: v.string(),
  }),
});

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, (character) => character.charCodeAt(0));
};

const decodeImage = (image: string) => {
  const dataUrl = /^data:(image\/[^;,]+);base64,([\s\S]+)$/.exec(image);
  const mediaType = dataUrl?.[1] ?? "image/png";
  const base64 = dataUrl?.[2] ?? image;

  try {
    return {
      bytes: base64ToUint8Array(base64),
      mediaType,
    };
  } catch {
    return null;
  }
};

const getCloudflareError = async (response: Response) => {
  try {
    const body = (await response.json()) as {
      errors?: Array<{ message?: string }>;
    };
    return body.errors?.find((error) => error.message)?.message;
  } catch {
    return undefined;
  }
};

export async function POST(request: Request) {
  const parsed = v.safeParse(
    schema,
    await request.json().catch(() => undefined),
  );
  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  const { prompt, model } = parsed.output;
  const catalogModel = await getCatalogModel(
    model,
    "Text to Image",
    "workers-ai",
  );
  if (!catalogModel) {
    return new Response(
      "The model catalog has changed. Refresh and select another model.",
      { status: 409 },
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CF_WORKERS_AI_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({ prompt }),
    },
  );

  if (!response.ok) {
    const message = await getCloudflareError(response);
    console.error(`Image generation failed for ${model}: ${response.status}`);
    return new Response(
      message ?? `Cloudflare image generation failed (${response.status})`,
      { status: response.status >= 400 && response.status < 500 ? 400 : 502 },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().startsWith("image/")) {
    return new Response(response.body, {
      headers: { "Content-Type": contentType },
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return new Response(
      `Unsupported image response from ${catalogModel.name}: expected an image or JSON result.image`,
      { status: 502 },
    );
  }

  const imageResult = v.safeParse(imageResponseSchema, json);
  if (!imageResult.success) {
    return new Response(
      `Unsupported image response from ${catalogModel.name}: expected a single result.image`,
      { status: 502 },
    );
  }

  const image = decodeImage(imageResult.output.result.image);
  if (!image) {
    return new Response(
      `Invalid base64 image returned by ${catalogModel.name}`,
      { status: 502 },
    );
  }

  return new Response(image.bytes, {
    headers: { "Content-Type": image.mediaType },
  });
}
