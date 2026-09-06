export type ModelType = "Text Generation" | "Text to Image";
export type ModelProvider = "workers-ai" | "google";
export type ModelSource = "cloudflare" | "external";
export type ModelInput = "image" | "search";

export interface Model {
  id: string;
  name: string;
  brand: string;
  type: ModelType;
  provider: ModelProvider;
  source: ModelSource;
  input?: ModelInput[];
  reasoning?: boolean;
  tools?: boolean;
  tag?: string[];
}

const BRAND_NAMES: Record<string, string> = {
  "black-forest-labs": "Black Forest Labs",
  bytedance: "ByteDance",
  "deepseek-ai": "DeepSeek",
  google: "Google",
  leonardo: "Leonardo",
  lykon: "Lykon",
  meta: "Meta",
  mistralai: "Mistral",
  moonshotai: "Moonshot AI",
  openai: "OpenAI",
  qwen: "Qwen",
  "zai-org": "ZAI",
};

export const externalModels: Model[] = [
  {
    id: "gemini-3.5-flash",
    name: "gemini-3.5-flash",
    brand: "Google",
    type: "Text Generation",
    input: ["image", "search"],
    provider: "google",
    source: "external",
  },
];

export const getModelName = (id: string) => id.split("/").at(-1) ?? id;

export const getModelBrand = (id: string) => {
  const namespace = id.split("/")[1];
  if (!namespace) {
    return "Other";
  }

  return (
    BRAND_NAMES[namespace] ??
    namespace
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
};

export const getModelGroup = (model: Model) =>
  model.source === "external" ? "External" : model.brand;

export const getExternalModels = () => {
  const providers = process.env.NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS?.split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);

  return externalModels.filter((model) => providers?.includes(model.provider));
};
