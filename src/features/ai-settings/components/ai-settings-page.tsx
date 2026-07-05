/**
 * AISettingsPage — configure AI providers (OpenAI, Anthropic, Gemini): API key,
 * model, temperature, max tokens and system prompt. One tab per provider; the
 * active provider (used by the assistant) is marked and switchable.
 *
 * Drop into a route, e.g. `/app/settings/ai`.
 */
import { useState } from "react";
import { CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CONFIGURABLE_PROVIDERS, PROVIDER_META } from "../provider-meta";
import { useAISettings } from "../hooks/use-ai-settings";
import { ApiKeyField } from "./api-key-field";
import { ProviderForm } from "./provider-form";
import type { ConfigurableProviderId } from "../types";

interface AISettingsPageProps {
  className?: string;
}

export function AISettingsPage({ className }: AISettingsPageProps) {
  const { activeProvider, setActiveProvider, secretStatus } = useAISettings();
  const [editing, setEditing] = useState<ConfigurableProviderId>(activeProvider);

  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-6", className)}>
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Providers
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure the AI providers the assistant can use. Keys are stored only on this device.
        </p>
      </div>

      <Tabs value={editing} onValueChange={(v) => setEditing(v as ConfigurableProviderId)}>
        <TabsList className="grid w-full grid-cols-3">
          {CONFIGURABLE_PROVIDERS.map((p) => (
            <TabsTrigger key={p} value={p} className="gap-1.5">
              {PROVIDER_META[p].label}
              {activeProvider === p && (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-label="Active" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {CONFIGURABLE_PROVIDERS.map((p) => (
          <TabsContent key={p} value={p}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {PROVIDER_META[p].label}
                      {activeProvider === p ? (
                        <Badge className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        secretStatus[p].set && <Badge variant="secondary">Configured</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Provider settings used when {PROVIDER_META[p].label} is active.
                    </CardDescription>
                  </div>
                  {activeProvider !== p && (
                    <Button variant="outline" size="sm" onClick={() => setActiveProvider(p)}>
                      Set as active
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ApiKeyField provider={p} />
                <Separator />
                {/* Remount per provider so the form re-seeds from saved config. */}
                <ProviderForm key={p} provider={p} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>About key storage</AlertTitle>
        <AlertDescription>
          Keys are obfuscated in this browser's local storage and never shown again after saving —
          only a masked preview is displayed. Browser storage is not a hardened secret store: for
          production, keys belong in server-side secrets (see the AI architecture). No key is ever
          sent anywhere from this screen.
        </AlertDescription>
      </Alert>
    </div>
  );
}
