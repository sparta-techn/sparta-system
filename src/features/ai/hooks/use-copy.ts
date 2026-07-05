/**
 * Clipboard copy with transient "copied" state and a toast.
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useCopy(timeout = 1500): {
  copied: boolean;
  copy: (text: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        window.setTimeout(() => setCopied(false), timeout);
      } catch {
        toast.error("Couldn't copy");
      }
    },
    [timeout],
  );

  return { copied, copy };
}
