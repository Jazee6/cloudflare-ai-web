import type { Model } from "@/components/model-select";

interface Data {
  prompt: string;
  model: Model["id"];
}

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
    return new Response("Error generating image", { status: 500 });
  }

  const image = await res.blob();

  return new Response(image);
}
