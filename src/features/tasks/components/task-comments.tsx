import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addComment, useTasksState } from "../store";
import { employeeById } from "../utils";
import { EmployeeChip } from "./employee-chip";

export function TaskComments({ taskId }: { taskId: string }) {
  const comments = useTasksState((s) => s.comments.filter((c) => c.taskId === taskId));
  const [body, setBody] = useState("");

  return (
    <div className="space-y-3">
      <ScrollArea className="max-h-[360px]">
        <ul className="space-y-3 pr-3">
          {comments.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
              No comments yet. Start the conversation.
            </p>
          ) : (
            comments.map((c) => {
              const author = employeeById(c.authorId);
              return (
                <li key={c.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between text-xs">
                    <EmployeeChip id={c.authorId} />
                    <span className="text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.body}</p>
                  <p className="sr-only">By {author?.name}</p>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          addComment(taskId, "emp_001", body.trim());
          setBody("");
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          rows={2}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!body.trim()} aria-label="Send comment">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
