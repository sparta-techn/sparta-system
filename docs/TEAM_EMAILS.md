# Team emails (HR broadcast)

One composed message sent to a chosen set of employees, with per-recipient
delivery tracking. Owner/Admin only.

---

## 1. Shape

Two tables, mirroring the rewards/payslip split between "the thing that
happened" and "who was actually told":

| Table                      | Holds                                          |
| -------------------------- | ---------------------------------------------- |
| `general_emails`           | the broadcast: subject + sanitized body, once   |
| `general_email_deliveries` | one row per recipient, carrying its own outcome |

Delivery status moves `pending → sent | failed`. Two CHECK constraints make a
silent failure impossible: a `failed` row must carry `error_message`, a `sent`
row must carry `sent_at` — the same guarantee `rewards` gives.

`UNIQUE (email_id, employee_id)` means a double-submitted send or a duplicated
selection is a constraint violation rather than two identical emails in
someone's inbox (the reasoning behind `payslip_deliveries_unique_attempt`).

`provider_message_id` records the Resend receipt per recipient, so an "I never
got it" claim can be traced to a single delivery.

---

## 2. One failure does not stop the send

Each recipient is sent independently inside a `try`/`catch`. A bad address, a
bounce or a provider hiccup is recorded on that recipient's row and the loop
continues — twelve recipients with one bad address still means eleven delivered
emails. The caller gets a per-recipient result, never a single boolean, and the
UI reports a partial send as a warning naming the damage rather than as success.

The message and every delivery row are written **before** any email goes out, so
a crash mid-send leaves a truthful record: rows still `pending` are exactly the
people who may not have been reached.

An employee with no linked account or no address is **not** skipped — they get a
`failed` row saying so, otherwise the broadcast would quietly reach fewer people
than it claimed.

---

## 3. The body is sanitized before storage

`sanitizeEmailHtml` reduces the composer's HTML to a twelve-tag allow-list
(`p, br, strong, b, em, i, u, ul, ol, li, a, blockquote`). Everything else is
dropped, keeping the text; `script`, `style`, `iframe`, `object`, `embed` and
`template` are dropped along with their contents. All attributes are stripped
except `href` on `<a>`, which must pass `safeUrl()` — the same gate the markdown
renderer uses — and surviving links are forced to `rel="noopener noreferrer"`.

Sanitization happens **before storage**, so the stored body is what the preview,
the email and the history all render. The composer sanitizes too, but only for
its preview; the server never trusts it.

No DOM-based sanitizer (and so no jsdom) is pulled in: the tokenizer is pure and
runs on the server. That is only safe because the tag set is tiny — **keep it
tiny**.

---

## 4. Branding and bidi

The header, card chrome and "sent by" footer come from `renderEmailShell`
(`features/payroll/email-shell.ts`), extracted from the reward email so a
broadcast is visibly the same product without the branding being written twice.
`reward-email.ts` was refactored onto the same shell; its tests confirm the
output is unchanged.

Bidi handling differs from the reward email in one way worth knowing. There, the
Latin runs needing isolation were *known values* (a company name, an amount).
Here the body is free text, so the runs are *discovered*: when the body contains
Arabic, `isolateLatinRuns` wraps each Latin-script run in `<span dir="ltr">` so
brand names, URLs and numbers keep their word and digit order inside RTL
paragraphs. A body with no Arabic is left alone — isolating every run would be
noise. Character references are treated as atomic, since splitting `&amp;` into
`&<span dir="ltr">amp</span>;` would corrupt it into visible text.

---

## 5. The editor

A minimal `contenteditable` component (bold, italic, lists, links) rather than a
WYSIWYG library: the body needs four options and the output is reduced to the
allow-list anyway, so a framework would ship hundreds of kilobytes to produce
markup that is then discarded. `document.execCommand` is deprecated but is the
only dependency-free option and is confined to that one component — everything
downstream sees plain HTML, so replacing it later touches nothing else.

Paste is forced to plain text: pasted rich markup would be stripped on send, so
accepting it would show formatting in the composer that silently disappears from
the email.

---

## 6. Access

Owner / Admin, enforced in three places — the route guard (UX), `authorize()` in
the server function against real `user_roles` grants (the real gate), and RLS on
both tables (the backstop). The HR subnav filters the tab by the same roles.

---

## 7. Files

| Concern           | File                                                            |
| ----------------- | --------------------------------------------------------------- |
| Schema + RLS      | `supabase/migrations/20260809130000_general_emails.sql`          |
| Sanitizer         | `src/features/general-emails/sanitize-html.ts`                   |
| Sanitizer tests   | `src/features/general-emails/sanitize-html.test.ts`              |
| Template (pure)   | `src/features/general-emails/general-email.ts`                   |
| Template tests    | `src/features/general-emails/general-email.test.ts`              |
| Shared shell      | `src/features/payroll/email-shell.ts`                            |
| Orchestrator      | `src/features/general-emails/general-email.server.ts`            |
| Server RPCs       | `src/features/general-emails/general-email.functions.ts`         |
| Composer          | `src/features/general-emails/components/compose-broadcast.tsx`   |
| Editor            | `src/features/general-emails/components/rich-text-editor.tsx`    |
| History           | `src/features/general-emails/components/broadcast-history.tsx`   |
| Route             | `src/routes/_authenticated/app/hr.team-emails.tsx`               |
