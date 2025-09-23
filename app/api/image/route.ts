import type { Model } from "@/components/model-select";
import { experimental_generateImage as generateImage } from "ai";
import { workersai } from "@/app/api";

interface Data {
  prompt: string;
  model: Model["id"];
}

export async function POST(request: Request) {
  const { prompt, model } = (await request.json()) as Data;

  const { image } = await generateImage({
    model: workersai.image(model),
    prompt,
    // size: "1024x1024",
    n: 1,
  });

  const { uint8Array, mediaType } = image;

  return new Response(new Blob([uint8Array.buffer as ArrayBuffer]), {
    headers: {
      "Content-Type": mediaType,
    },
  });
}
