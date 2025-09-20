import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CopyButton = ({ id, className }: { id: string; className?: string }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const text = document.getElementById(id)?.innerText;
    if (text) {
      setCopied(true);
      await navigator.clipboard.writeText(text);
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={onCopy}
      className={cn(className)}
    >
      <Copy
        className={`transition-all
        ${copied ? "scale-0" : "scale-100"}
      `}
      />
      <Check
        className={`absolute transition-all ${
          copied ? "scale-100" : "scale-0"
        }`}
      />
    </Button>
  );
};

export default CopyButton;
