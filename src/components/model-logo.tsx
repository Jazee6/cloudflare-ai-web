import {
  DeepSeekLogo,
  GoogleLogo,
  KIMILogo,
  MetaLogo,
  OpenAILogo,
  QWenLogo,
  ZhiPuLogo,
} from "@/components/logo";
import type { Model } from "@/lib/models";

const DefaultLogo = () => (
  <span className="block size-4 rounded-full bg-linear-to-br from-secondary to-primary" />
);

export const ModelLogo = ({ model }: { model: Model }) => {
  switch (model.brand) {
    case "DeepSeek":
      return <DeepSeekLogo />;
    case "Google":
      return <GoogleLogo />;
    case "Meta":
      return <MetaLogo />;
    case "Moonshot AI":
      return <KIMILogo />;
    case "OpenAI":
      return <OpenAILogo />;
    case "Qwen":
      return <QWenLogo />;
    case "ZAI":
      return <ZhiPuLogo />;
    default:
      return <DefaultLogo />;
  }
};
