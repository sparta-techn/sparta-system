/**
 * ApiKeyField — secure key entry for one provider.
 *
 * Security posture: the stored key is **never** rendered back — when a key is set
 * the field shows only a masked preview (`sk-…a1b2`). The input holds only what
 * the user is currently typing (a new/replacement key), behind a password field
 * with an optional reveal toggle. On save the value is validated for shape, then
 * handed to the obfuscated secret store; it is never logged or placed in the
 * config store.
 */
import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PROVIDER_META } from "../provider-meta";
import { validateApiKey } from "../validation";
import { clearApiKey, setApiKey, useSecretStatus } from "../secure-store";
import type { ConfigurableProviderId } from "../types";

interface ApiKeyFieldProps {
  provider: ConfigurableProviderId;
}

export function ApiKeyField({ provider }: ApiKeyFieldProps) {
  const meta = PROVIDER_META[provider];
  const status = useSecretStatus()[provider];
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const message = validateApiKey(provider, value);
    if (message) {
      setError(message);
      return;
    }
    setApiKey(provider, value);
    setValue("");
    setReveal(false);
    setError(null);
    toast.success(`${meta.label} API key saved`);
  };

  const remove = () => {
    clearApiKey(provider);
    toast.success(`${meta.label} API key removed`);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={`apikey-${provider}`} className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          API Key
        </Label>
        {status.set && (
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <Check className="h-3 w-3" />
            {status.preview}
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={`apikey-${provider}`}
            type={reveal ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            placeholder={status.set ? "Enter a new key to replace" : meta.keyPlaceholder}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            className="pr-9 font-mono"
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={reveal ? "Hide key" : "Show key"}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button type="button" onClick={save} disabled={!value.trim()}>
          {status.set ? "Replace" : "Save"}
        </Button>
        {status.set && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={remove}
            aria-label="Remove key"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {meta.keyHint}{" "}
          <a
            href={meta.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Get a key
          </a>
        </p>
      )}
    </div>
  );
}
