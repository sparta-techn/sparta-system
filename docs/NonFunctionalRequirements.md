# Non-Functional Requirements — SpartaFlow Hub

## 1. Security

- All traffic over HTTPS/TLS 1.2+.
- Passwords stored using a strong adaptive hash (bcrypt / argon2).
- Role-based access control enforced server-side on every request; UI hiding is never the only protection.
- Row-level access rules so a Team Lead cannot see another team's data.
- Two-factor authentication available to all users, required for Owner and HR by v1.1.
- Sensitive actions (role changes, attendance overrides, leave approvals) recorded in an immutable audit log.
- Secrets stored in a managed secret store, never in source.
- Personal data handled in compliance with GDPR principles: data minimization, right to access, right to deletion, documented retention periods.
- Regular dependency vulnerability scans and quarterly penetration tests once in production.
- Session timeout after 12 hours of inactivity; forced re-login on role change.

## 2. Performance

- P95 page load < 2 seconds on a 10 Mbps connection.
- P95 API response < 300 ms for dashboard reads.
- Daily workflow actions (start, check-in, status, report, finish) complete in < 500 ms.
- Dashboards refresh near-real-time (≤ 5 s) for live team status.
- Reports up to 10 000 rows export in < 10 s.

## 3. Scalability

- Designed to support up to 1 000 employees and 50 departments without architectural change.
- Horizontally scalable stateless application tier.
- Database designed for time-series growth (attendance, reports, audit logs) with partitioning by month.
- Notification delivery handled via an asynchronous queue to absorb spikes.

## 4. Availability

- Target uptime: **99.9% monthly** (≈ 43 min downtime / month).
- Planned maintenance windows announced ≥ 48 hours in advance and scheduled outside core working hours.
- Automated daily backups with 30-day retention; weekly backups with 1-year retention.
- Documented RPO ≤ 1 hour, RTO ≤ 4 hours.

## 5. Accessibility

- WCAG 2.1 Level AA conformance for all primary user flows.
- Full keyboard navigation; visible focus states.
- Screen-reader friendly labels on every interactive element.
- Color contrast ratio ≥ 4.5:1 for text.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- All flows operable without a mouse and without sound.

## 6. Maintainability

- Documented coding standards, naming conventions, and folder structure.
- Modular feature boundaries (attendance, workflow, dependencies, etc.) with explicit interfaces.
- Automated unit, integration, and end-to-end tests with ≥ 70% coverage on critical paths.
- CI/CD pipeline: every merge runs lint, type-check, tests, and security scan before deploy.
- Feature flags for risky rollouts.
- Living documentation kept in `/docs` and updated with each feature.

## 7. Reliability

- Graceful degradation: if notifications are down, the daily workflow still works.
- Idempotent write endpoints for attendance and report actions (no duplicate Start Work on retry).
- Background jobs are retried with exponential backoff and a dead-letter queue.
- Error reporting and alerting integrated with on-call.

## 8. Observability

- Structured logging on the server with correlation IDs per request.
- Application metrics (latency, error rate, queue depth, daily-flow completion rate).
- Real-user monitoring on the client (page load, JS errors).
- Dashboards and alerts for SLO breaches.

## 9. Internationalization & Localization

- English at launch; architecture supports adding languages without code changes to UI components.
- All dates, times, and durations rendered in the user's timezone.
- 24-hour clock by default, configurable per user.

## 10. Compliance & Data Handling

- Data residency configurable by company policy.
- Data export available on request for any employee (their own data).
- Data deletion workflow on offboarding, with HR approval and audit trail.

## 11. Browser & Device Support

- Latest two versions of Chrome, Edge, Safari, Firefox.
- Responsive design from 360 px (mobile) to 1920 px (desktop).
- Mobile web is fully functional; native mobile apps are a future consideration.

## 12. Usability

- Daily flow completable in < 2 minutes total per day.
- New employees can complete their first day without training.
- Empty states, error states, and loading states explicitly designed — never blank screens.
- Destructive actions require confirmation and are undoable where possible.
