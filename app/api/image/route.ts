import * as v from "valibot";
import {
  createImageRunRequest,
  getImageFailureStatus,
  MAX_IMAGE_PROMPT_LENGTH,
  toImageResponse,
} from "@/lib/image-generation";
import { getCatalogModel } from "@/lib/model-catalog";
import {
  getCloudflareCredentials,
  getCloudflareGatewayCredentials,
  ProviderConfigurationError,
} from "@/lib/providers";
import { parseJsonRequest } from "@/lib/request-limits";

const schema = v.object({
  prompt: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_IMAGE_PROMPT_LENGTH)),
  model: v.pipe(v.string(), v.minLength(1)),
});

export async function POST(request: Request) {
  const parsed = await parseJsonRequest(request, schema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const { prompt, model } = parsed.data;
  const catalogModel = await getCatalogModel(model, "Text to Image", "workers-ai");
  if (!catalogModel) {
    return new Response("The model catalog has changed. Refresh and select another model.", {
      status: 409,
    });
  }

  let runRequest: ReturnType<typeof createImageRunRequest>;
  try {
    runRequest = createImageRunRequest({
      ...getCloudflareCredentials(),
      gateway: getCloudflareGatewayCredentials(),
      model,
      prompt,
    });
  } catch (error) {
    if (error instanceof ProviderConfigurationError) {
      console.error(error.message);
      return new Response("Image generation is not configured.", { status: 503 });
    }
    throw error;
  }

  let response: Response;
  try {
    response = await fetch(runRequest.url, runRequest.init);
  } catch (error) {
    console.error(`Image generation request failed for ${model}`, error);
    return new Response("Image generation failed. Please try again.", { status: 502 });
  }
  if (!response.ok) {
    console.error(`Image generation failed for ${model}: ${response.status}`);
    return new Response("Image generation failed. Please try again.", {
      status: getImageFailureStatus(response.status),
    });
  }

  return toImageResponse(response);
}
