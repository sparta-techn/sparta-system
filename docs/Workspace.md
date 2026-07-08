# Workspace — SpartaFlow Hub

The **Workspace** holds settings shared by everyone in the company. It is the root of the Project tree: change something here and every project that doesn't override it picks up the new value.

## Surface

`/app/projects/workspace`

A single settings page grouped by concern. Save is sticky at the bottom — you never have to scroll to commit changes.

## Settings

### Company

| Field          | Notes                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Logo (initial) | One- or two-character monogram; renders in the sidebar and tab favicons. |
| Company name   | Used in headers, exports, and email templates.                           |

### Working hours

| Field        | Notes                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Timezone     | IANA name. Drives attendance, midday reminders, EOD timestamps.             |
| Start / End  | 24-hour HH:MM.                                                              |
| Working days | Toggle chips for Mon → Sun. Drives attendance gating and report compliance. |

### Languages

A chip selector for company languages. Surfaces in the directory, document tagging, and (future) localization defaults.

### Defaults

| Field                    | Notes                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| Default task statuses    | Comma-separated list. Used when a new project starts from scratch (no template). |
| Default project template | The template auto-selected in the "New project" dialog.                          |

## Storage

Persisted in `localStorage` under `spartaflow:projects:v1` → `workspace`. Reads and writes go through `getWorkspace()` / `updateWorkspace(patch)`. The Supabase migration will swap the store for a single `workspace_settings` row keyed by company without changing the panel.

## Future expansion

- Holidays calendar (already modeled in `public.holidays`).
- Per-team overrides (e.g. design team works Sun–Thu).
- Logo upload (image, not just initials).
- Brand color tokens that feed the design system.
- Locale, currency, date format defaults.

## Accessibility

- Day toggles use `<button aria-pressed>`.
- Language chips are keyboard-activatable.
- All inputs have explicit `<Label>` associations.
- The save bar is reachable via keyboard tab order and is announced as `<footer role="contentinfo">` equivalent (sticky region inside the panel).
