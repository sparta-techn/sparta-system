# Information Architecture — SpartaFlow Hub

## 1. Principles

- One primary navigation, consistent across roles; items appear or hide based on permissions.
- Personal pages first, team pages second, company pages third.
- Every page has a single, unambiguous purpose.
- Maximum two levels of nesting in the main navigation.

## 2. Top-Level Sitemap

```
SpartaFlow Hub
├── /                              Personal Dashboard (home)
├── /workflow                      Today's daily workflow
│   ├── /workflow/morning          Morning Check-in
│   ├── /workflow/midday           Midday Status
│   └── /workflow/end-of-day       End-of-Day Report
├── /attendance                    My attendance history
├── /dependencies                  My dependencies (sent + received)
├── /announcements                 Announcement feed
├── /notifications                 Notification center
├── /directory                     Employee directory
├── /projects                      Projects overview (read-only, sourced from ClickUp)
├── /leaves                        My leaves and requests
│
├── /team                          (Team Lead, PM)
│   ├── /team/overview             Live team status
│   ├── /team/reports              Team daily reports
│   ├── /team/dependencies         Team dependency board
│   ├── /team/workload             Workload heatmap
│   └── /team/performance          Team performance trends
│
├── /department                    (PM, Owner)
│   ├── /department/overview       Department status
│   ├── /department/dependencies   Cross-department dependency board
│   └── /department/performance    Department metrics
│
├── /hr                            (HR, Owner)
│   ├── /hr/attendance             Company attendance
│   ├── /hr/leaves                 Leave management
│   ├── /hr/employees              Employee management
│   ├── /hr/announcements          Manage announcements
│   ├── /hr/reports                HR reports & exports
│   └── /hr/onboarding             Onboarding & offboarding
│
├── /owner                         (Owner only)
│   ├── /owner/health              Company health dashboard
│   ├── /owner/departments         Department comparison
│   └── /owner/insights            Operational insights
│
├── /admin                         (Owner, HR)
│   ├── /admin/roles               Role management
│   ├── /admin/permissions         Permission policies
│   ├── /admin/departments         Departments & teams
│   ├── /admin/integrations        ClickUp, Slack, Google, GitHub, Figma
│   ├── /admin/audit-logs          Audit log viewer
│   └── /admin/settings            Company-wide settings
│
├── /settings                      Personal settings
│   ├── /settings/profile
│   ├── /settings/notifications
│   ├── /settings/security         (password, 2FA)
│   └── /settings/preferences      (timezone, language, theme)
│
├── /help                          Help center & onboarding tour
├── /login
├── /forgot-password
├── /404
└── /500
```

## 3. Navigation Structure by Role

| Role | Primary Nav |
|---|---|
| Employee | Home, Workflow, Attendance, Dependencies, Announcements, Directory, Projects, Leaves |
| Team Lead | Employee items + Team |
| Project Manager | Team Lead items + Department |
| HR | Employee items + HR + Admin (limited) |
| Owner | Everything |
| Viewer | Configurable subset of dashboards (read-only) |

## 4. Page Anatomy (Consistent Across the App)

```
┌─────────────────────────────────────────────────────────┐
│ Top bar: logo · global search · notifications · profile │
├─────────────┬───────────────────────────────────────────┤
│             │ Page header: title · breadcrumb · actions │
│  Sidebar    ├───────────────────────────────────────────┤
│  (role-     │                                           │
│  filtered)  │              Page content                 │
│             │                                           │
│             │                                           │
└─────────────┴───────────────────────────────────────────┘
```

## 5. Information Hierarchy

1. **Personal layer** — what the logged-in user must do today.
2. **Team layer** — the user's direct team (if applicable).
3. **Department layer** — cross-team coordination (if applicable).
4. **Company layer** — company-wide visibility (HR / Owner).
5. **Admin layer** — configuration and governance.

Each layer is progressively disclosed; an employee never sees the admin layer, an HR member sees up to the company layer.

## 6. Global Patterns

- **Global search**: searches employees, departments, announcements, dependencies, reports.
- **Notification center**: opens as a side panel from the top bar on any page.
- **Today widget**: the workflow step indicator is visible on every page until the day is completed.
- **Breadcrumbs**: shown on all non-dashboard pages.

## 7. Empty, Loading, and Error States

Every page defines:
- **Loading state** — skeleton, not spinner.
- **Empty state** — explains why it's empty and what to do next.
- **Error state** — explains what failed and offers a retry.
- **No permission state** — explains the permission required and who can grant it.
