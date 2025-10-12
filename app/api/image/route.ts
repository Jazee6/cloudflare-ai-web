import type { Model } from "@/lib/models";

interface Data {
  prompt: string;
  model: Model["id"];
}

const base64ToBlob = (base64: string, mime: string) => {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mime });
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

  const data: {
    result: {
      image: string;
    };
  } = await res.json();

  return new Response(base64ToBlob(data.result.image, "image/png"), {
    headers: {
      "Content-Type": "image/png",
    },
  });
}
