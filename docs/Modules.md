# Feature Modules — SpartaFlow Hub

Every module is a vertical slice (`domain → application → infrastructure → ui`) with a small, explicit public API. Modules communicate via their public API or domain events — never deep imports.

For each module: **Purpose**, **Responsibilities**, **Dependencies**, **Public API**, **Reusable Components**, **Future Expansion**.

---

## 1. Authentication

- **Purpose:** Identify users, manage sessions, enforce MFA where required.
- **Responsibilities:** sign-in / sign-up / sign-out, password reset, SSO (Google), MFA enrolment, session refresh, claim injection on signup.
- **Dependencies:** Supabase Auth, `user_roles`, Edge Function `set-claims`.
- **Public API:** `useAuth()`, `useSession()`, `requireRole(role)`, `signIn`, `signOut`, `getServerSession()`.
- **Reusable components:** `AuthCard`, `SignInForm`, `SignUpForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `MfaChallenge`.
- **Future:** SAML SSO, passkeys, device management, IP allow-listing for HR/Owner.

## 2. Dashboard

- **Purpose:** Personalized landing surface — "what do I need to do today, and who needs me?".
- **Responsibilities:** Today's workflow step, attendance status, open dependencies, unread notifications, announcements, streak.
- **Dependencies:** Attendance, Workflow, Dependencies, Notifications, Announcements.
- **Public API:** `DashboardScreen`, `useDashboardData()`.
- **Components:** `WorkflowStepCard`, `AttendanceStatusCard`, `DependencyDigest`, `NotificationDigest`, `StreakBadge`.
- **Future:** Role-specific dashboards (HR, PM, Owner), customizable widgets, AI daily summary.

## 3. Attendance

- **Purpose:** Record Start Work, Break, Finish Work; enforce working rules (09:00–10:00 arrival, 1h break cap).
- **Responsibilities:** action endpoints, late/overage detection, daily attendance record, manual override (HR).
- **Dependencies:** Auth, Notifications (late alerts), AuditLog (overrides).
- **Public API:** `useAttendanceToday()`, `startWork`, `startBreak`, `endBreak`, `finishWork`, `overrideAttendance(adminOnly)`.
- **Components:** `AttendanceCard`, `BreakTimer`, `LateBadge`, `AttendanceTimeline`.
- **Future:** geofencing (optional), holiday calendars per region, integration with HRIS.

## 4. Workflow — Morning Check-in

- **Purpose:** Capture "what I'll work on today" in < 60 s.
- **Responsibilities:** structured template (focus, ClickUp tasks, planned dependencies), draft autosave, submission.
- **Dependencies:** Auth, ClickUp integration (task linking), Notifications.
- **Public API:** `MorningCheckInScreen`, `submitMorningCheckIn`.
- **Components:** `WorkflowStepper`, `TaskPicker`, `MoodSelector` (optional).
- **Future:** AI-suggested focus from yesterday's EOD, calendar-aware planning.

## 5. Workflow — Midday Status

- **Purpose:** Short pulse update mid-day.
- **Responsibilities:** progress %, blockers, ETA changes.
- **Dependencies:** Workflow Morning, Dependencies.
- **Public API:** `MiddayStatusScreen`, `submitMiddayStatus`.
- **Components:** `ProgressInput`, `BlockerPicker`.
- **Future:** auto-skip on low-volume days, AI-detected blocker patterns.

## 6. Workflow — End-of-Day Report

- **Purpose:** Capture what was completed, what's pending, what's blocked.
- **Responsibilities:** structured fields, attachments, link to ClickUp items, submission, late-report nudges.
- **Dependencies:** Workflow Morning, Dependencies, Notifications, Reports (rollup).
- **Public API:** `EndOfDayScreen`, `submitEndOfDayReport`.
- **Components:** `ReportEditor`, `AttachmentDropzone`, `TaskOutcomeList`.
- **Future:** AI summary per team, automatic carry-over of pending items to next morning.

## 7. Dependencies

- **Purpose:** Track cross-person / cross-department blockers with SLAs.
- **Responsibilities:** create, acknowledge, resolve, escalate; aging and priority; cross-department board.
- **Dependencies:** Auth, Notifications, AuditLog.
- **Public API:** `useDependencies(filters)`, `createDependency`, `acknowledgeDependency`, `resolveDependency`, `escalateDependency`.
- **Components:** `DependencyCard`, `DependencyBoard`, `AgeBadge`, `DependencyTimeline`.
- **Future:** AI risk scoring, auto-routing to on-call, integration with ClickUp tasks.

## 8. Notifications

- **Purpose:** Deliver actionable signals in-app, by email, and optionally via Slack.
- **Responsibilities:** templating, dispatch, per-user preferences, read state, digest mode.
- **Dependencies:** All event-producing modules; Slack integration; Email adapter.
- **Public API:** `useNotifications()`, `markRead`, `markAllRead`, `NotificationCenter`.
- **Components:** `NotificationCard`, `NotificationCenter`, `PreferenceToggle`.
- **Future:** push notifications, smart batching, quiet hours respect.

## 9. Announcements

- **Purpose:** Company / department / team broadcasts with read tracking.
- **Responsibilities:** authoring, audience targeting, pinning, expiry, read receipts.
- **Dependencies:** Auth (RBAC), Notifications.
- **Public API:** `useAnnouncements()`, `createAnnouncement`, `acknowledgeAnnouncement`.
- **Components:** `AnnouncementBanner`, `AnnouncementEditor`, `AudiencePicker`, `ReadReceiptList`.
- **Future:** rich media, scheduled publishing, mandatory acknowledgement flow.

## 10. Reports

- **Purpose:** Aggregate operational data for managers, HR, Owner.
- **Responsibilities:** attendance summary, report completion, dependency aging, custom date ranges, exports.
- **Dependencies:** Attendance, Workflow, Dependencies.
- **Public API:** `useReport(spec)`, `exportReport(spec, format)`.
- **Components:** `ReportFilters`, `ReportTable`, `ChartCard`, `ExportMenu`.
- **Future:** scheduled reports, PDF templates, anomaly detection, AI executive summary.

## 11. Performance

- **Purpose:** Per-employee, per-team, per-department performance signals over time.
- **Responsibilities:** trend metrics derived from attendance, reports, dependency throughput.
- **Dependencies:** Reports, Attendance, Workflow, Dependencies.
- **Public API:** `usePerformance(scope)`, `PerformanceScreen`.
- **Components:** `TrendChart`, `MetricCard`, `Heatmap`, `ComparisonTable`.
- **Future:** GitHub / Figma signals, AI coaching panel, calibration workflow.

## 12. Employee Directory

- **Purpose:** Searchable, filterable list of employees with profiles.
- **Responsibilities:** directory search, profile view, contact links, org-chart view.
- **Dependencies:** Auth, HR (profile data).
- **Public API:** `useDirectory(filters)`, `DirectoryScreen`, `EmployeeProfile`.
- **Components:** `EmployeeCard`, `OrgChart`, `DirectoryFilters`, `SearchBox`.
- **Future:** skills graph, "who works on what" via ClickUp signals.

## 13. HR

- **Purpose:** HR-owned operations: leaves, onboarding, offboarding, compliance.
- **Responsibilities:** leave requests/approvals, balances, calendar, onboarding checklists.
- **Dependencies:** Auth, Notifications, AuditLog, Directory.
- **Public API:** `useLeaves(scope)`, `requestLeave`, `approveLeave`, `OnboardingChecklist`.
- **Components:** `LeaveRequestForm`, `LeaveCalendar`, `BalanceCard`, `ChecklistItem`.
- **Future:** payroll exports, contract reminders, regional compliance modules.

## 14. Admin

- **Purpose:** Operational configuration of the platform.
- **Responsibilities:** departments, teams, roles, working rules, feature flags, integration tokens.
- **Dependencies:** Auth, AuditLog, all configurable modules.
- **Public API:** `AdminScreen`, `useAdminConfig`.
- **Components:** `ConfigSection`, `RoleMatrixEditor`, `FeatureFlagToggle`, `TokenManager`.
- **Future:** multi-company support, environment promotion of config.

## 15. Owner

- **Purpose:** Strategic, company-wide view for the Founder/CEO.
- **Responsibilities:** company health score, department comparison, risk surface, weekly digest.
- **Dependencies:** Reports, Performance, Dependencies, Attendance.
- **Public API:** `OwnerDashboard`, `useCompanyHealth`.
- **Components:** `HealthScoreGauge`, `DepartmentRanking`, `RiskList`, `WeeklyDigest`.
- **Future:** capacity planning, AI executive briefing, scenario modeling.

## 16. Settings

- **Purpose:** Per-user personalization.
- **Responsibilities:** profile, timezone, notification preferences, theme, MFA, sessions.
- **Dependencies:** Auth, Notifications.
- **Public API:** `SettingsScreen`, `useUserPreferences`.
- **Components:** `ProfileForm`, `PreferenceToggle`, `SessionList`, `MfaSection`.
- **Future:** integrations per user (personal Slack, calendar), API tokens.

## 17. Audit Logs

- **Purpose:** Immutable record of sensitive actions.
- **Responsibilities:** append-only logging, filtering, export.
- **Dependencies:** Every privileged action emits to it.
- **Public API:** `useAuditLogs(filters)`, `logAuditEvent(event)` (server-only).
- **Components:** `AuditTable`, `AuditFilters`, `EventDetailDrawer`.
- **Future:** SIEM export, anomaly alerts, SOC 2 evidence pack.
