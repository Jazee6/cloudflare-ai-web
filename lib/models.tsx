import type { ReactNode } from "react";
import {
  DeepSeekLogo,
  GoogleLogo,
  MetaLogo,
  MistralLogo,
  QWenLogo,
} from "@/components/logo";

export interface Model {
  id: string;
  name: string;
  logo: ReactNode;
  type: "Text Generation" | "Text to Image";
}

export const models: Model[] = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "llama-4-scout-17b",
    logo: <MetaLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/google/gemma-3-12b-it",
    name: "gemma-3-12b",
    logo: <GoogleLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    name: "mistral-small-3.1-24b",
    logo: <MistralLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/qwen/qwq-32b",
    name: "qwq-32b",
    logo: <QWenLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "deepseek-r1-distill-qwen-32b",
    logo: <DeepSeekLogo />,
    type: "Text Generation",
  },
  {
    id: "@cf/black-forest-labs/flux-1-schnell",
    name: "flux-1-schnell",
    logo: (
      <div className="bg-linear-to-br from-secondary to-primary size-4 rounded-full"></div>
    ),
    type: "Text to Image",
  },
];
