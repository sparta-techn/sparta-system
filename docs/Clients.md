# Clients — SpartaFlow Hub

A **Client** is the organization (external or internal) that a project is delivered for. Clients are optional on a project — projects without a client are "Internal".

## Why first-class clients

- Group projects by who they're for, not just by department.
- Centralize commercial contact info (person, email, phone, address).
- Surface client-wide health: how many active projects, how many at-risk.
- Foundation for future SOWs, invoicing, and engagement reporting.

## Surfaces

| Route | Purpose |
| --- | --- |
| `/app/projects/clients` | Directory of all clients with search and project counts |
| `/app/projects/clients/$id` | Client header, contact card, notes, linked projects |

## Fields

| Field | Notes |
| --- | --- |
| Company | Required; used as the display name. |
| Contact person | Primary contact at the client. |
| Email | Primary email for correspondence. |
| Phone | International format recommended. |
| Address | Free-text. |
| Notes | Markdown-friendly free-text for context (steering cadence, contract terms, etc.). |
| Logo | Auto-derived monogram tinted from a stable hue per client. |
| Projects | Computed from `projects.clientId`. |

Create flow: a single dialog with one required field (company). Everything else can be added later from the detail page.

## Storage shape

```ts
interface Client {
  id: string;
  company: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  logoHue: number;
  projects: string[]; // mirror of projects.clientId
  createdAt: string;
}
```

`listClients() / getClient(id) / createClient(input) / updateClient(id, patch)` are the only API consumers should use. Projects → client linkage is a many-to-one: each project carries `clientId`, the client side is computed.

## Reuse from the rest of the app

- Project list filters by client.
- Project create dialog picks a client from this directory.
- Future: announcements scoped to all employees on a given client's projects; quarterly client reports auto-generated from EOD reports.

## Accessibility & UX

- The directory table is keyboard-navigable; rows link to detail.
- Client logo uses a `aria-hidden` decorative span and the company name is the accessible label.
- Empty states explain how to add or link a project.
