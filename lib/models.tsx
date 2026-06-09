import type { ReactNode } from "react";
import {
  DeepSeekLogo,
  GoogleLogo,
  KIMILogo,
  MetaLogo,
  OpenAILogo,
  QWenLogo,
  ZhiPuLogo,
} from "@/components/logo";

export interface Model {
  id: string;
  name: string;
  logo: ReactNode;
  type: "Text Generation" | "Text to Image";
  input?: Array<"image" | "search">;
  provider: "workers-ai" | "google";
  tag?: string[];
}

const defaultLogo = (
  <div className="bg-linear-to-br from-secondary to-primary size-4 rounded-full"></div>
);

export const modelList: Model[] = [
  {
    id: "@cf/moonshotai/kimi-k2.6",
    name: "kimi-k2.6",
    logo: <KIMILogo />,
    type: "Text Generation",
    input: ["image"],
    provider: "workers-ai",
    tag: ["new"],
  },
  {
    id: "@cf/zai-org/glm-4.7-flash",
    name: "glm-4.7-flash",
    logo: <ZhiPuLogo />,
    type: "Text Generation",
    provider: "workers-ai",
    tag: ["new"],
  },
  {
    id: "@cf/openai/gpt-oss-120b",
    name: "gpt-oss-120b",
    logo: <OpenAILogo />,
    type: "Text Generation",
    provider: "workers-ai",
    tag: ["new"],
  },
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    name: "gemma-4-26b-a4b-it",
    logo: <GoogleLogo />,
    type: "Text Generation",
    input: ["image"],
    provider: "workers-ai",
    tag: ["new"],
  },
  {
    id: "gemini-3.5-flash",
    name: "gemini-3.5-flash",
    logo: <GoogleLogo />,
    type: "Text Generation",
    input: ["image", "search"],
    provider: "google",
  },
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "llama-4-scout-17b-16e-instruct",
    logo: <MetaLogo />,
    type: "Text Generation",
    input: ["image"],
    provider: "workers-ai",
  },
  {
    id: "@cf/qwen/qwq-32b",
    name: "qwq-32b",
    logo: <QWenLogo />,
    type: "Text Generation",
    // input: ["image"],
    provider: "workers-ai",
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "deepseek-r1-distill-qwen-32b",
    logo: <DeepSeekLogo />,
    type: "Text Generation",
    provider: "workers-ai",
  },
  {
    id: "@cf/bytedance/stable-diffusion-xl-lightning",
    name: "stable-diffusion-xl-lightning",
    logo: defaultLogo,
    type: "Text to Image",
    provider: "workers-ai",
  },
  {
    id: "@cf/black-forest-labs/flux-1-schnell",
    name: "flux-1-schnell",
    logo: defaultLogo,
    type: "Text to Image",
    provider: "workers-ai",
  },
  {
    id: "@cf/leonardo/lucid-origin",
    name: "lucid-origin",
    logo: defaultLogo,
    type: "Text to Image",
    provider: "workers-ai",
  },
  {
    id: "@cf/lykon/dreamshaper-8-lcm",
    name: "dreamshaper-8-lcm",
    logo: defaultLogo,
    type: "Text to Image",
    provider: "workers-ai",
  },
];

const providers = process.env.NEXT_PUBLIC_CF_AI_GATEWAY_PROVIDERS?.split(",");

export const models = modelList.filter(
  (i) => providers?.includes(i.provider) || i.provider === "workers-ai",
);
