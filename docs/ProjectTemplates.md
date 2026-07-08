# Project Templates — SpartaFlow Hub

A **Project Template** seeds a new project with sensible defaults so creation takes seconds instead of minutes. Templates are the bridge between "every project is unique" and "no project should start from a blank slate".

## What a template carries

| Field                          | Notes                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| Name, icon, color, description | Identity.                                                               |
| Default statuses               | Status columns the future Tasks board will render.                      |
| Default milestones             | Suggested checkpoints; appear on project Overview from day one.         |
| Default project roles          | Role buckets to invite into (lead, contributor, reviewer, stakeholder). |
| Recommended duration           | Used to pre-fill the project end date.                                  |
| Usage count                    | Informational signal — which templates the company actually relies on.  |

## Built-in templates

| Template        | Statuses                                     | Milestones                                       |
| --------------- | -------------------------------------------- | ------------------------------------------------ |
| Flutter App     | Backlog → In Design → In Dev → QA → Released | MVP · Beta · Public Launch                       |
| Backend API     | Spec → Building → Review → Deployed          | Schema frozen · Internal alpha · GA              |
| Website         | Wireframe → Design → Build → QA → Live       | Design freeze · Soft launch · Public launch      |
| Admin Dashboard | Backlog → In Progress → Review → Done        | Auth + shell · Core modules · Reports · Handover |
| Internal Tool   | Todo → Doing → Done                          | v1                                               |

These match the most common project shapes for a software company and double as examples for teams creating new templates.

## Surfaces

| Route                     | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `/app/projects/templates` | Browse, create, and "Use template" entry point |

Clicking **Use template** opens the project creation dialog with the template pre-selected; defaults are applied automatically.

## Custom templates

Anyone with project-create permission can:

1. Click **New template** in the template library.
2. Name + describe it.
3. Provide default statuses and milestones (comma-separated for speed).
4. Save — it appears immediately in the library and in the New Project dialog's template selector.

In the next phase, a "Save as template" action will appear on any existing project's settings page, pre-filling the form with that project's actual statuses and milestones.

## Storage

```ts
interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultStatuses: string[];
  defaultMilestones: string[];
  defaultRoles: ProjectRole[];
  recommendedDuration: number; // days
  usageCount: number;
}
```

Stored on the workspace level — every member sees the same template library. The schema is intentionally lean so it maps cleanly to a single Supabase table when persistence lands.

## Why this matters for the under-2-minute create rule

Without templates, every new project requires the creator to invent their workflow. With templates, the creator picks one and is done. The most common project type ("Backend API") becomes effectively zero-effort to start.
