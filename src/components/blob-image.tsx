import type { ComponentProps } from "react";
import ZoomableImage from "@/components/zoomable-image";
import { useObjectUrl } from "@/hooks/use-object-url";

/**
 * Renders a zoomable image kept as a Blob in Conversation History. The zoom wrapper mounts
 * with the image, since it only attaches to an image present when it mounts.
 */
const BlobImage = ({
  blob,
  zoomClassName,
  ...props
}: { blob: Blob; zoomClassName?: string } & Omit<ComponentProps<"img">, "src">) => {
  const url = useObjectUrl(blob);
  if (!url) {
    return null;
  }
  return (
    <ZoomableImage className={zoomClassName}>
      <img src={url} {...props} />
    </ZoomableImage>
  );
};

export default BlobImage;
