# SpartaFlow — MVP Manual QA Checklist

Walk this end-to-end with **2–3 real accounts** before rollout. Each section maps to one
Definition-of-Done bullet from the MVP spec, with concrete user-facing steps and the
expected result. Check the box only when the expected result is met on a real environment
(not a mock/dev seed).

> **⚠️ Watch-for notes** flag places where earlier code review found mock or localStorage
> data still in the path for an in-MVP feature. Scrutinize these — if you see sample data
> that a fresh account shouldn't have, or data that doesn't appear on a second account,
> that's a real DoD gap, not a test-setup issue.

---

## Test accounts & environment setup

Prepare before starting:

- [ ] **Account O — Owner**: created by the bootstrap step (Section 1).
- [ ] **Account M — Manager**: invited with a **Project Manager** role (Section 2).
- [ ] **Account E — Employee**: invited with an **Employee** role (Section 2).
- [ ] Two devices/browsers (or one normal + one incognito) so you can be signed into two
      accounts at once and verify cross-user visibility.
- [ ] Access to the Supabase dashboard (Table Editor) for the project, to confirm rows
      actually land server-side.
- [ ] Note the environment URL and record **Date / Tester / Build (git SHA): ____________**

---

## 1. Owner can create an organization

Org creation is a one-time provisioning step (self-signup is disabled by design — the
login page shows "Ask HR or an administrator to invite you"). It runs via the bootstrap
script and is then verified in the app.

**Steps**
1. From the project root, run the status check: `bun run bootstrap --status`.
2. If `bootstrapped: false`, run the bootstrap with env vars set:
   `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… OWNER_EMAIL=owner@yourco.com OWNER_PASSWORD='…' COMPANY_NAME='Your Co' bun run bootstrap`
   (optional: `OWNER_NAME`, `COMPANY_SLUG`, `COMPANY_TIMEZONE`).
3. Re-run `bun run bootstrap --status` and confirm it now reports `bootstrapped: true` with
   a non-empty `company id`.
4. Open the app at `/auth`, sign in as **Account O** with the owner email/password.
5. Go to **Admin Console** (`/app/admin`) → **Organization** tab.
6. Confirm the organization identity (company name, timezone) is shown. Edit the company
   name / support email / working hours and click **Save**.
7. Reload the page.

**Expected result**
- [ ] Bootstrap reports `bootstrapped: true` and a company id.
- [ ] Owner can sign in and reach the Admin Console.
- [ ] The Organization tab shows the real company created at bootstrap.
- [ ] Edits persist across reload, and the change is visible in Supabase (`companies` row).
- [ ] Attempting self-signup is not possible (no register form; login says to ask an admin).

---

## 2. Employees can be invited and assigned roles

**Steps (as Owner — Account O)**
1. Sign in as **Account O**. Go to **HR** (`/app/hr`) → **Invitations** (`/app/hr/invitations`).
2. Click **Invite** (invite-employee dialog). Enter **Account M**'s email, choose role
   **Project Manager**, pick a department, and send.
3. Repeat for **Account E** with role **Employee**.
4. Confirm both invitations appear in the invitations list with status **Pending**.
5. Open the invite email for each account (or the invite link) and follow it to
   `/auth/accept-invitation`; set a password and complete acceptance for both.

**Steps (verify roles)**
6. Sign in as **Account M**, then **Account E**, at `/auth`.
7. As Owner, open **HR → Directory** (`/app/hr/employees`) and confirm both new employees
   are listed with the correct role and department.

**Expected result**
- [ ] Invitations send without error and show as Pending in the list.
- [ ] Each invitee can accept via the link and set a password.
- [ ] After acceptance, each account can sign in.
- [ ] Directory shows M as Project Manager and E as Employee (roles took effect).
- [ ] In Supabase, `user_roles` has the correct `role` for each new user, and `profiles`
      status flips from `invited` → `active` after first login (Owner may also receive an
      "Invitation accepted" notification).
- [ ] ⚠️ **Watch for:** the department dropdown in the invite/employee dialogs should list
      the org's real departments (from Supabase), not a fixed sample list. Also confirm the
      invitation list still shows the invites after a hard reload / on a second admin's
      screen (invite tracking should not be device-local).

---

## 3. Employees can log in securely

**Steps**
1. At `/auth`, sign in as **Account E** with correct credentials → expect success.
2. Sign out. Sign in again with a **wrong password** → expect a clear error, no session.
3. While signed out, directly visit a protected URL, e.g. `/app/tasks`.
4. Sign in as **Account E**, then in the same browser open `/app/admin` (owner-only).
5. Use **Forgot password?** (`/auth/forgot-password`) for Account E; follow the reset email
   to `/auth/reset-password` and set a new password; sign in with it.
6. Sign in, then leave the tab idle / clear the session and try to act (or open
   `/auth/session-expired` scenario by removing the stored session).

**Expected result**
- [ ] Correct credentials sign in; wrong password is rejected with a friendly message.
- [ ] Visiting a protected URL while signed out redirects to `/auth` (not a broken page).
- [ ] Employee E is **denied** the owner-only Admin Console (redirected to `/unauthorized`).
- [ ] Password reset flow works end-to-end; the new password logs in and the old one fails.
- [ ] A lost/expired session routes to `/auth/session-expired`, not a crash.

---

## 4. Employees can check in and check out

Attendance is the work-session clock (Start work → breaks → Finish work). Do this as
**Account E**.

**Steps**
1. Sign in as **Account E**. Go to **Attendance** (`/app/attendance`).
2. On the "Today" card, click **Start work** (check in).
3. Confirm the card switches to a running state and the **Worked** timer begins counting.
4. Click **Start break**, wait a few seconds, then **Resume work**; confirm break time is
   tracked and working time pauses/resumes correctly.
5. Click **Finish work** (check out) → review the finish summary dialog (worked, break,
   overtime, late, started/finished times) and confirm.
6. Reload the page; then open the app as **Account E on a second device/browser**.
7. Open the Supabase Table Editor and check `attendance_sessions` / `break_sessions` for
   today's rows for this user.

**Expected result**
- [ ] Start work begins a live-counting session; the state is correct after reload.
- [ ] Breaks pause working time and are recorded; Resume continues the session.
- [ ] Finish work closes the day and shows an accurate summary; the card shows "Day finished".
- [ ] The same status appears on the second device (server-backed, not local-only).
- [ ] Corresponding rows exist in Supabase for the session and any breaks.

---

## 5. Employees can submit morning, midday, and end-of-day reports

Do all three as **Account E** on the same work date.

**Morning check-in**
1. Go to **Check-in** (`/app/check-in`). Complete the wizard (mood, main goal, planned
   priorities/tasks) and **Submit**.
2. Reload; confirm the submitted check-in is shown as done for today (not an empty draft).

**Midday**
3. Go to **Midday** (`/app/midday`). Complete the midday update (progress, current focus,
   blockers) and **Submit**. Reload and confirm it persists.

**End-of-day**
4. Go to **End-of-day** (`/app/eod`). Complete the EOD report and **Submit**.
5. Open **EOD history** (`/app/eod/history`) and confirm today's submission appears.
6. Verify persistence on a second device / after clearing the browser's localStorage and
   reloading.
7. In Supabase, confirm `daily_status_updates` has a `morning_checkin` and a `midday` row,
   and `daily_reports` has today's row with status `submitted`.

**Expected result**
- [ ] Each of the three submits without error and shows a submitted (not draft) state.
- [ ] Submissions survive reload, a second device, and localStorage clear (draft may be
      local, but the **submitted** report must be server-backed).
- [ ] EOD history lists the real submission.
- [ ] Rows exist in `daily_status_updates` (morning + midday) and `daily_reports` (eod).
- [ ] ⚠️ **Watch for:** the planned-tasks picker and the people/department pickers inside
      the wizards should reflect real tasks/employees, not a canned sample list. An
      unsubmitted **draft** persisting locally is fine; a **submitted** report that only
      exists in your browser is a failure.

---

## 6. Managers can create projects and assign tasks

Do this as **Account M** (Project Manager).

**Steps**
1. Sign in as **Account M**. Go to **Projects** (`/app/projects`) and click to create a
   new project (create-project dialog): name it, set color/icon, and save.
2. Confirm the project appears in the list and open its detail page.
3. Add **Account E** as a member of the project (so the assignee can see the task).
4. Go to **Tasks** (`/app/tasks`), click **New task**. Enter a title, select the project
   from step 1, set a status/priority, and **assign it to Account E**. Save.
5. Confirm the new task appears in the Tasks list and on the **Kanban** board
   (`/app/tasks/kanban`) in the correct column.
6. In Supabase, confirm the `projects` row, the `project_members` row for E, and the
   `tasks` row (with `assignee_id` = E, correct `project_id`) exist.

**Expected result**
- [ ] Manager can create a project; it persists and is visible on reload.
- [ ] Manager can create a task, tie it to the project, and assign it to Employee E.
- [ ] Task appears in list and Kanban views.
- [ ] Rows exist in `projects`, `project_members`, and `tasks` in Supabase.
- [ ] Employee E receives a "task assigned" notification (bell / `/app/notifications`).
- [ ] ⚠️ **Watch for:** the project picker in the New Task dialog should list real projects,
      not seeded sample projects. If E can't see the task in Section 7, verify E was
      actually added as a project member (task visibility is membership-scoped).

---

## 7. Employees can complete and update tasks

Do this as **Account E**, on the task created in Section 6.

**Steps**
1. Sign in as **Account E**. Go to **Tasks** (`/app/tasks`) → confirm the assigned task is
   visible (in list and/or **My tasks** / Kanban).
2. Open the task detail (`/app/tasks/<id>`). Change its **status** (e.g. To do → In
   progress), and edit a field (e.g. description). Save.
3. On the **Kanban** board, move the task to another column (e.g. In progress → Done) if
   drag is supported.
4. Reload, and re-open as **Account M** on a second device.
5. In Supabase, confirm the `tasks` row reflects the latest `status` and edits.

**Expected result**
- [ ] Employee E sees the task assigned to them.
- [ ] Status changes and field edits save and survive reload.
- [ ] Kanban moves update the task status.
- [ ] Manager M sees the updated status on their side (server-backed, cross-user).
- [ ] The `tasks` row in Supabase shows the new status/edits.
- [ ] A "task status changed" notification reaches the assignee/creator as appropriate.
- [ ] ⚠️ **Watch for:** core fields (title, status, assignee, priority, description) must
      persist server-side. Some **rich** fields (labels, checklist, watchers) are known to
      be stored as a local overlay and are out of MVP scope — note them but they are not a
      DoD failure for this bullet.

---

## 8. Owners and managers can monitor attendance and task progress from dashboards

Do this as **Account O** and **Account M**, after Accounts E/M have generated real activity
(Sections 4–7) **today**.

**Steps**
1. As **Account M**, open **Attendance → Team** (`/app/attendance/team`) and confirm
   today's real check-in/out status for Account E is shown.
2. As **Account M** (or Owner), open the **Manager** dashboard (`/app/manager`) and the
   **Report reviews** surface (`/app/report-review`); confirm E's submitted reports from
   Section 5 appear for review.
3. Open the main **Dashboard** (`/app`) as Owner and as Manager; confirm attendance/task/
   report widgets reflect **the real activity you just generated**, not unrelated names or
   numbers.
4. Cross-check one number (e.g. count of submitted reports today, or tasks in each status)
   against what you actually created.

**Expected result**
- [ ] Attendance → Team shows Account E's real session status for today.
- [ ] Report reviews / Manager view lists the reports E actually submitted.
- [ ] Dashboard figures match the real data you generated during this QA run.
- [ ] ⚠️ **Watch for (high risk):** earlier review found the **main dashboard widgets** and
      the **manager midday/EOD team overviews** are still backed by mock/sample data. If you
      see teammates, activity, dependencies, or report/attendance summaries that you did
      **not** create in this session (or that are identical to a fresh install's seed data),
      that is a **DoD gap** for this bullet. The wired surfaces to trust are
      **Attendance → Team** and **Report reviews**; treat the `/app` landing widgets and the
      manager midday/eod overview tiles with suspicion until verified.

---

## 9. All data is stored/retrieved from Supabase with no mock/localStorage dependency (in-MVP features)

This is a cross-cutting verification. Repeat the "persistence probe" for each in-MVP data
type below.

**Persistence probe (per feature)**
1. Create/modify the item as one account (see the relevant section above).
2. **Second-account check:** open the intended second account (Owner/Manager/other) on a
   different device and confirm the item appears — proving it's shared server-side, not
   local.
3. **Storage-clear check:** on the original account, open DevTools → Application →
   Local Storage, clear the site's entries, and reload. The item must still be present.
4. **Supabase check:** confirm the corresponding table has the row.

**Run the probe against each in-MVP data type**
- [ ] **Organization** (`companies`) — Section 1 edits persist after storage-clear and in Supabase.
- [ ] **Employees & roles** (`profiles`, `user_roles`) — Section 2 users/roles visible to a second admin and in Supabase.
- [ ] **Invitations** — pending/accepted state visible to a second admin and after storage-clear (not device-local).
- [ ] **Attendance** (`attendance_sessions`, `break_sessions`) — Section 4 status on a second device and in Supabase.
- [ ] **Morning/Midday reports** (`daily_status_updates`) — Section 5 submissions after storage-clear and in Supabase.
- [ ] **EOD reports** (`daily_reports`) — Section 5 submission in EOD history after storage-clear and in Supabase.
- [ ] **Projects & members** (`projects`, `project_members`) — Section 6 visible to the assignee and in Supabase.
- [ ] **Tasks** (`tasks`, core fields) — Sections 6–7 changes visible cross-user and in Supabase.
- [ ] **Notifications** (`notifications`) — task-assign / report-submit notifications arrive live and in Supabase.

**Expected result**
- [ ] Every in-MVP data type above survives the storage-clear reload, appears on a second
      account, and has a matching Supabase row.
- [ ] ⚠️ **Known suspects to confirm are NOT relied on (from prior review):** main dashboard
      widgets, manager midday/EOD overviews, notification **preferences** (a Supabase table
      exists but the UI may still write localStorage), HR department dropdowns, and the
      check-in/midday/EOD in-wizard people/task pickers. Any of these showing sample data or
      failing the second-account/storage-clear check is a DoD gap to log.

---

## Sign-off

- [ ] All nine sections pass on a clean environment with real accounts.
- [ ] Any ⚠️ watch-for that failed is logged with the section number and a screenshot.
- [ ] Tester: ________________  Date: __________  Build (git SHA): ________________
