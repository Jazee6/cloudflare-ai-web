import type { Model } from "@/lib/models";

interface Data {
  prompt: string;
  model: Model["id"];
}

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, (m) => m.codePointAt(0) ?? 0);
};

export async function POST(request: Request) {
  const { prompt, model } = (await request.json()) as Data;

  const res = await fetch(
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
