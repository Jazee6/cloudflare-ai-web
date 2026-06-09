import { z } from "zod";
import { models } from "@/lib/models";

const imageModels = models
  .filter((m) => m.type === "Text to Image")
  .map((m) => m.id) as [string, ...string[]];

const schema = z.object({
  prompt: z.string(),
  model: z.enum(imageModels),
});

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, (m) => m.codePointAt(0) ?? 0);
};

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return new Response("Invalid request data", { status: 400 });
  }

  const { prompt, model } = parsed.data;

  let res: Response;
  // if (model === "@cf/black-forest-labs/flux-2-klein-4b") {
  //   const form = new FormData();
  //   form.append("prompt", prompt);
  //
  //   res = await fetch(
  //     `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`,
  //     {
  //       headers: {
  //         Authorization: `Bearer ${process.env.CF_WORKERS_AI_TOKEN}`,
  //         "Content-Type": "multipart/form-data",
  //       },
  //       method: "POST",
  //       body: form,
  //     },
  //   );
  // }
  res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CF_WORKERS_AI_TOKEN}`,
      },
      method: "POST",
      body: JSON.stringify({
        prompt,
        // steps: 4,
      }),
    },
  );

  if (!res.ok) {
    console.error(res);
    return new Response("Error generating image", { status: 500 });
  }

  switch (model) {
    case "@cf/lykon/dreamshaper-8-lcm":
    case "@cf/bytedance/stable-diffusion-xl-lightning": {
      return new Response(res.body);
    }
    case "@cf/black-forest-labs/flux-1-schnell":
    case "@cf/leonardo/lucid-origin": {
      const data: {
        result: {
          image: string;
        };
      } = await res.json();
      return new Response(base64ToUint8Array(data.result.image));
    }
  }
}
