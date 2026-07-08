# Functional Requirements — SpartaFlow Hub

Requirements are grouped by module. Each requirement is uniquely identified (e.g. `FR-ATT-01`) for traceability.

---

## 1. Authentication & Account (FR-AUTH)

- **FR-AUTH-01** Users must log in with email and password.
- **FR-AUTH-02** Support single sign-on via Google Workspace.
- **FR-AUTH-03** Support password reset via email.
- **FR-AUTH-04** Support session expiry and forced re-login after inactivity.
- **FR-AUTH-05** Support two-factor authentication (optional in MVP, required in v1.1 for Owner/HR).
- **FR-AUTH-06** Users must have a profile (name, avatar, role, department, employment type, timezone, working hours preference).

---

## 2. Attendance (FR-ATT)

- **FR-ATT-01** Employees must mark **Start Work** between 09:00 and 10:00 local time.
- **FR-ATT-02** Employees can mark **Start Break** and **End Break**, with a maximum cumulative break of 1 hour per day.
- **FR-ATT-03** Employees must mark **Finish Work** when ending the day.
- **FR-ATT-04** The system computes daily worked hours, break time, late arrival, and early finish automatically.
- **FR-ATT-05** Employees can submit a reason when arriving late or finishing early.
- **FR-ATT-06** Managers and HR can view attendance per employee, team, department, day, week, and month.
- **FR-ATT-07** HR can export attendance to CSV / Excel for any date range.
- **FR-ATT-08** The system raises an alert if an employee has not started work by 10:15.
- **FR-ATT-09** The system raises an alert if total break time exceeds 1 hour.
- **FR-ATT-10** Attendance entries are immutable once the day ends, except via HR override with an audit log entry.

---

## 3. Daily Workflow (FR-WF)

- **FR-WF-01** Each working day exposes a guided flow: Login → Start Work → Morning Check-in → Midday Status → End-of-Day Report → Finish Work.
- **FR-WF-02** The current step is always visible on the personal dashboard.
- **FR-WF-03** The Morning Check-in collects: today's planned focus, expected blockers, dependencies needed from other departments, estimated availability hours.
- **FR-WF-04** The Midday Status collects: progress vs. morning plan, new blockers, changed dependencies, request for help.
- **FR-WF-05** The End-of-Day Report collects: what was completed, what is in progress, what was blocked, links to ClickUp tasks, summary of dependencies sent and received.
- **FR-WF-06** Each step has a soft deadline (Morning by 10:30, Midday by 14:00, End-of-Day by Finish Work) and triggers a reminder if missed.
- **FR-WF-07** Employees can edit a submitted step until the day is closed.
- **FR-WF-08** Managers can view all submitted steps for their team.
- **FR-WF-09** The system aggregates all reports per team, department, and company per day.

---

## 4. Dependencies (FR-DEP)

- **FR-DEP-01** Any employee can create a dependency: _I (or my team) am waiting on X from team Y_.
- **FR-DEP-02** A dependency has: requester, target department, target person (optional), description, expected resolution date, priority, related ClickUp task link (optional).
- **FR-DEP-03** Target department receives a notification and the dependency appears on their team board.
- **FR-DEP-04** Target can: acknowledge, accept with ETA, reject with reason, or mark as resolved.
- **FR-DEP-05** Open dependencies are visible on team and department dashboards, sorted by age.
- **FR-DEP-06** The system tracks resolution time as a KPI per department.
- **FR-DEP-07** Dependencies overdue by more than 24 working hours are escalated to the Team Lead and Project Manager.

---

## 5. Announcements (FR-ANN)

- **FR-ANN-01** HR, Owner, and Project Managers can create announcements.
- **FR-ANN-02** An announcement has: title, body (rich text), audience (company / department / role), priority, optional expiry date.
- **FR-ANN-03** Recipients see announcements on their dashboard and as a notification.
- **FR-ANN-04** Recipients can mark as read; sender sees read rate.
- **FR-ANN-05** Pinned announcements stay on the dashboard until the expiry date.

---

## 6. Notifications (FR-NOT)

- **FR-NOT-01** In-app notification center showing all events relevant to the user.
- **FR-NOT-02** Email notifications for high-priority items (blocker escalations, leave decisions, mandatory announcements).
- **FR-NOT-03** Optional browser push notifications.
- **FR-NOT-04** Per-user notification preferences (channels, categories, quiet hours).
- **FR-NOT-05** Notifications are grouped by category and marked read individually or in bulk.

---

## 7. Dashboards (FR-DASH)

### Employee Dashboard

- **FR-DASH-E-01** Shows today's workflow step, attendance status, current working hours, today's announcements, my open dependencies, my notifications.

### Team Lead / Project Manager Dashboard

- **FR-DASH-M-01** Live team status (working / on break / late / off).
- **FR-DASH-M-02** Daily report completion status per team member.
- **FR-DASH-M-03** Open blockers and dependencies sorted by age.
- **FR-DASH-M-04** Team workload heatmap.
- **FR-DASH-M-05** Weekly and monthly performance trends.

### HR Dashboard

- **FR-DASH-H-01** Company-wide attendance summary.
- **FR-DASH-H-02** Late / absent employees today.
- **FR-DASH-H-03** Pending leave requests.
- **FR-DASH-H-04** Announcement read rates.
- **FR-DASH-H-05** Employee directory and department breakdown.

### Owner Dashboard

- **FR-DASH-O-01** Company health score.
- **FR-DASH-O-02** Department performance comparison.
- **FR-DASH-O-03** Blocker rate trend per department.
- **FR-DASH-O-04** Headcount, attendance, and engagement summary.

---

## 8. Leaves (FR-LEAVE)

- **FR-LEAVE-01** Employees can request leave (vacation, sick, personal, unpaid) with start/end date and reason.
- **FR-LEAVE-02** Requests route to Team Lead → HR for approval.
- **FR-LEAVE-03** Approved leaves appear on team calendars and affect attendance expectations.
- **FR-LEAVE-04** HR can configure leave balances per employee per year.

---

## 9. Employee Directory (FR-DIR)

- **FR-DIR-01** Searchable directory of all employees.
- **FR-DIR-02** Filter by department, role, employment type, location/timezone.
- **FR-DIR-03** Each profile shows contact info, role, manager, current workflow status (respecting privacy rules).

---

## 10. Projects Overview (FR-PROJ)

- **FR-PROJ-01** Read-only summary view of active projects sourced from ClickUp integration (v1.1+).
- **FR-PROJ-02** Each project shows team, status, open blockers in SpartaFlow Hub linked to it.
- **FR-PROJ-03** No task editing — SpartaFlow Hub never writes back into ClickUp tasks.

---

## 11. Reports (FR-REP)

- **FR-REP-01** Generate reports for: attendance, daily workflow completion, dependencies, leaves, announcement engagement.
- **FR-REP-02** Filter by date range, department, team, employee.
- **FR-REP-03** Export to CSV, Excel, PDF.
- **FR-REP-04** Schedule recurring reports via email (weekly / monthly).

---

## 12. Performance Analytics (FR-PERF)

- **FR-PERF-01** Per-employee, per-team, per-department metrics: attendance compliance, report completion, blocker resolution time, dependency turnaround.
- **FR-PERF-02** Trends over week, month, quarter.
- **FR-PERF-03** Benchmark against company average.

---

## 13. Roles & Permissions (FR-RBAC)

- **FR-RBAC-01** Roles: Owner, HR, Project Manager, Team Lead, Employee, Viewer.
- **FR-RBAC-02** Permissions are role-based and resource-scoped (e.g. Team Lead sees only their team).
- **FR-RBAC-03** Owner and HR can change roles; changes are audited.
- **FR-RBAC-04** Viewer role has read-only access to dashboards as configured.

---

## 14. Audit Logs (FR-AUD)

- **FR-AUD-01** All sensitive actions are logged: role changes, attendance overrides, leave approvals, announcement edits, permission changes.
- **FR-AUD-02** Logs are immutable and viewable by Owner and HR.
- **FR-AUD-03** Each log entry records actor, action, target, timestamp, IP, and reason where applicable.

---

## 15. Settings (FR-SET)

- **FR-SET-01** Personal settings: profile, notification preferences, timezone, language.
- **FR-SET-02** Company settings (Owner/HR): working hours, break policy, departments, roles, integrations.
- **FR-SET-03** Department settings (Team Lead): team composition, working hours override (if approved).

---

## 16. Integrations (FR-INT, v1.1+)

- **FR-INT-01** ClickUp: pull task links and project metadata.
- **FR-INT-02** Slack: send notifications to user DMs.
- **FR-INT-03** Google Calendar: read availability and write leave entries.
- **FR-INT-04** GitHub: read PR / commit activity for performance signals (opt-in).
- **FR-INT-05** Figma: read recently active files for designers (opt-in).
