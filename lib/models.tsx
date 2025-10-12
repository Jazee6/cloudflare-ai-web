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
  tag?: string[];
}

const defaultLogo = (
  <div className="bg-linear-to-br from-secondary to-primary size-4 rounded-full"></div>
);

export const models: Model[] = [
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    name: "llama-4-scout",
    logo: <MetaLogo />,
    type: "Text Generation",
    tag: ["17b"],
  },
  {
    id: "@cf/aisingapore/gemma-sea-lion-v4-27b-it",
    name: "gemma-sea-lion-v4",
    logo: <GoogleLogo />,
    type: "Text Generation",
    tag: ["27b"],
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    name: "mistral-small-3.1",
    logo: <MistralLogo />,
    type: "Text Generation",
    tag: ["24b"],
  },
  {
    id: "@cf/qwen/qwq-32b",
    name: "qwq",
    logo: <QWenLogo />,
    type: "Text Generation",
    tag: ["32b"],
  },
  {
    id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    name: "deepseek-r1-distill-qwen",
    logo: <DeepSeekLogo />,
    type: "Text Generation",
    tag: ["32b"],
  },
  {
    id: "@cf/leonardo/lucid-origin",
    name: "lucid-origin",
    logo: defaultLogo,
    type: "Text to Image",
  },
];
