# Onboarding & Offboarding

## Onboarding (`/app/hr/onboarding`)

A per-employee checklist with task ownership. Active onboarding employees are selectable from a dropdown.

Default checklist:

1. Account created (HR)
2. Invitation accepted (Employee)
3. Email verified (Employee)
4. Equipment assigned (IT)
5. Policies acknowledged (Employee)
6. Orientation completed (HR)
7. Manager 1:1 scheduled (Manager)

`HrOnboardingTask` shape:

```ts
interface HrOnboardingTask {
  id: string;
  employeeId: string;
  label: string;
  owner: "hr" | "it" | "manager" | "employee";
  status: "todo" | "in_progress" | "done";
  dueAt?: string;
}
```

The page shows completion progress and per-task ownership. Add task is a placeholder; full template editing belongs in HR settings.

## Offboarding (`/app/hr/offboarding`)

A linear workflow with exit-date awareness. Default checklist:

1. Disable account (IT)
2. Collect equipment (IT)
3. Transfer ownership (Manager)
4. Archive documents (HR)
5. Exit interview (HR)

When the workflow completes, the employee transitions to `status === "deactivated"` and appears under "Recently offboarded" with a Reactivate action.

## Lifecycle transitions

```text
invited ──accept──▶ active
active  ──leave──▶ on_leave ──return──▶ active
active  ──start offboarding──▶ offboarding ──complete──▶ deactivated
deactivated ──reactivate──▶ active
```

## Future backend

- `onboarding_templates` (per-role checklist definitions).
- `onboarding_tasks` + `offboarding_tasks` (per-employee instances).
- Triggers: completing the final offboarding task sets `employees.status = 'deactivated'` and revokes sessions via the auth admin API.
