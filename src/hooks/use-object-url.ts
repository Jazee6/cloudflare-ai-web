import { useEffect, useState } from "react";

/** An object URL for a Blob, revoked when the Blob changes or the component unmounts. */
export const useObjectUrl = (blob: Blob) => {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
};
