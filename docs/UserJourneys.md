# User Journeys — SpartaFlow Hub

Each journey describes a real workflow, step-by-step, from the user's point of view.

---

## 1. Employee — A Typical Working Day (Karim, Flutter Developer)

1. **08:55** Karim opens SpartaFlow Hub in his browser. He is auto-logged in via Google SSO.
2. **09:02** The dashboard shows the **Start Work** button as the active step. He clicks it. Attendance is recorded.
3. **09:03** The dashboard prompts him for the **Morning Check-in**. He fills:
   - Today's focus: "Finish payment screen UI integration."
   - Expected blockers: "Waiting on API contract from Backend."
   - Dependencies needed: he creates a dependency on the Backend team for the contract.
   - Estimated available hours: 7.
4. **09:05** He closes SpartaFlow Hub and works in his code editor and ClickUp.
5. **12:30** He clicks **Start Break**. The system starts timing his break.
6. **13:25** He clicks **End Break**. Break total: 55 min — within the 1 hour limit.
7. **13:30** A notification appears: **Midday Status due by 14:00**. He fills:
   - Progress: 60% of morning plan complete.
   - New blockers: none.
   - Dependency update: Backend acknowledged the contract dependency.
8. **17:45** He clicks **End-of-Day Report**. He fills:
   - Completed: payment screen UI, integrated 3 endpoints.
   - In progress: error-state handling.
   - Blocked on: none.
   - ClickUp links: pasted.
9. **17:50** He clicks **Finish Work**. The day is closed. Total worked: 7 h 55 min. Status: ✅ on-time, full flow completed.
10. **17:51** His streak counter increments. He closes the tab.

**Total time spent in SpartaFlow Hub:** ~ 90 seconds across the entire day.

---

## 2. Team Lead — Morning Check (Sara, Backend Team Lead)

1. **09:30** Sara opens the Team Lead dashboard.
2. She sees:
   - 6 of 8 team members have started work.
   - 1 is late (no Start Work, no leave on file) — flagged amber.
   - 1 is on approved leave — shown grayed out.
3. She clicks the late team member to see history and decides to send a quick DM.
4. She scans the **Open Dependencies** panel: 3 dependencies aimed at her team, none aged > 24 h.
5. She acknowledges all 3 and assigns ETAs.
6. She reviews the **Yesterday's Reports** panel and notices a recurring blocker mentioned by two engineers. She creates a dependency on DevOps to address it.
7. **Total time:** ~ 3 minutes.

---

## 3. Project Manager — End-of-Week Review (Marco)

1. **Friday 16:00** Marco opens the PM dashboard.
2. He reviews the **Weekly Performance** panel:
   - Daily report completion rate per team.
   - Average dependency resolution time per department.
   - Blockers raised vs. resolved.
3. He drills into Flutter team — two engineers had repeated "Waiting on Backend" blockers. He opens the dependency board, sees one was resolved in 3 hours, the other in 28 hours.
4. He generates a weekly report and schedules a Monday sync with the Backend Team Lead.
5. He posts an announcement to both teams summarizing the action items.

---

## 4. HR — Daily Routine (Lina)

1. **09:15** Lina opens the HR dashboard.
2. She reviews the **Today** panel:
   - 2 employees late.
   - 1 pending leave request.
   - 4 unread announcements with current read rates.
3. She approves the leave request. The requester and their Team Lead are notified.
4. She publishes an announcement: "Company All-Hands on Friday." Audience: Company. Priority: Normal. Expiry: Friday end-of-day.
5. She exports the monthly attendance report and shares it with Finance for payroll reconciliation.

---

## 5. Owner — Weekly Health Check (Adrian)

1. **Monday 08:30** Adrian opens the Owner dashboard.
2. He sees the **Company Health Score** — a composite of attendance, report completion, blocker rate, and dependency turnaround.
3. He notices the **AI department** has a declining score for the second week. He clicks in: blocker rate has doubled.
4. He sends a short message to the AI Team Lead requesting context.
5. He reviews the headcount and engagement summary, then closes the tab.
6. **Total time:** ~ 90 seconds.

---

## 6. New Employee — First Day Onboarding

1. The employee receives an invite email from HR.
2. They set a password (or sign in with Google), complete their profile, set timezone.
3. The dashboard greets them with a guided tour of the daily flow.
4. They mark **Start Work**.
5. They complete the Morning Check-in with help text inline.
6. By end of day, they have completed the full flow at least once.
7. HR sees the onboarding checklist as ✅ complete.

---

## 7. Blocker Escalation Journey

1. An engineer creates a dependency on the DevOps team at 10:00.
2. The dependency appears on the DevOps team board with a 24-working-hour SLA.
3. By 10:00 the next working day, it has not been acknowledged.
4. The system escalates: the DevOps Team Lead and the requester's Project Manager are notified.
5. Status changes to *Escalated* on dashboards and is reflected in the department's performance metrics.

---

## 8. Late Arrival Journey

1. 10:15 arrives. An employee has not started work and has no approved leave.
2. The system marks them as **Late** and notifies their Team Lead.
3. When the employee starts work, they are prompted (optional) to submit a brief reason.
4. The late event is recorded in their attendance history and visible to HR.

---

## 9. Forgotten End-of-Day Report Journey

1. 18:30 arrives. An employee has marked **Finish Work** but skipped the End-of-Day Report.
2. The system sends a single reminder.
3. If still missing at end-of-day cutoff, the day is recorded as **Report Missing** and visible to Team Lead and PM dashboards.
4. The employee can still submit the report within 24 hours, after which it is locked.
