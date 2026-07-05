/**
 * SuggestedPrompts — role-aware starters plus the user's favorite prompts, shown
 * on the empty state. Each suggestion can be sent with a click or starred to save
 * it as a favorite (persisted locally).
 */
import { Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-context";
import { suggestedPromptsFor } from "../suggested-prompts";
import { toggleFavorite, useAIChatState } from "../store";
import type { FavoritePrompt } from "../types";

interface SuggestedPromptsProps {
  onPick: (prompt: string) => void;
}

export function SuggestedPrompts({ onPick }: SuggestedPromptsProps) {
  const { roles } = useAuth();
  const suggestions = suggestedPromptsFor(roles as string[]);
  const favorites = useAIChatState((s) => s.favorites);
  const favoriteIds = new Set(favorites.map((f) => f.id));

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">How can I help?</h2>
        <p className="text-sm text-muted-foreground">
          Ask anything, or start with a suggestion below.
        </p>
      </div>

      {favorites.length > 0 && (
        <PromptGroup
          label="Favorites"
          items={favorites}
          favoriteIds={favoriteIds}
          onPick={onPick}
        />
      )}

      <PromptGroup
        label="Suggested"
        items={suggestions}
        favoriteIds={favoriteIds}
        onPick={onPick}
      />
    </div>
  );
}

interface PromptGroupProps {
  label: string;
  items: FavoritePrompt[];
  favoriteIds: Set<string>;
  onPick: (prompt: string) => void;
}

function PromptGroup({ label, items, favoriteIds, onPick }: PromptGroupProps) {
  return (
    <div className="w-full">
      <p className="mb-2 text-left text-xs font-medium text-muted-foreground uppercase">{label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-1 rounded-lg border bg-card p-1 pl-1 text-left hover:border-primary/40"
          >
            <button
              type="button"
              onClick={() => onPick(item.prompt)}
              className="flex-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              {item.title}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={favoriteIds.has(item.id) ? "Remove favorite" : "Save as favorite"}
              onClick={() =>
                toggleFavorite({ id: item.id, title: item.title, prompt: item.prompt })
              }
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  favoriteIds.has(item.id)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground",
                )}
              />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
