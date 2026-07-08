import type { ReactNode } from "react";
import { Workflow } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, description, children, footer }: Props) {
  return (
    <main className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="hidden bg-gradient-to-br from-primary/15 via-background to-background p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Workflow className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">SpartaFlow Hub</span>
        </div>
        <div className="max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            The operating system for a remote team.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in to share your day, unblock teammates, and keep work flowing — under two minutes
            of friction, every morning.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Internal platform · Access by invitation only
        </p>
      </aside>

      {/* Form panel */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Workflow className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">SpartaFlow Hub</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
