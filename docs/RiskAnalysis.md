# Risk Analysis — SpartaFlow Hub

Risks are grouped by category. Each risk is rated for **Likelihood** (L/M/H) and **Impact** (L/M/H) and includes a mitigation strategy.

---

## 1. Product Risks

### 1.1 Employees perceive the tool as surveillance
- **Likelihood:** High · **Impact:** High
- **Mitigation:** Communicate clearly that managers see signals (status, reports, blockers), not keystrokes or activity. Avoid features that track screen time or idle time. Make the value to the employee (clarity, fewer interruptions, visible work) explicit. Involve employees in design feedback rounds.

### 1.2 SpartaFlow Hub drifts into being a task manager
- **Likelihood:** Medium · **Impact:** High
- **Mitigation:** Enforce the "no task management" principle in every roadmap review. Any feature that overlaps with ClickUp requires explicit Owner approval. Integrate with ClickUp rather than replicate it.

### 1.3 Low adoption after launch
- **Likelihood:** Medium · **Impact:** High
- **Mitigation:** Keep the daily flow under 2 minutes. Run a 2-week pilot with one department before company rollout. Build a streak / habit reinforcement mechanic. Make missing the flow visible to managers without being punitive.

### 1.4 Report fatigue
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Keep templates short and structured. Pre-fill from previous day. Allow voice or paste-in input. Avoid required fields beyond the minimum.

---

## 2. Technical Risks

### 2.1 Performance degradation as company grows
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Architect for 1 000 employees from day one. Partition time-series tables (attendance, reports, audit logs). Continuous performance testing in CI.

### 2.2 Data loss
- **Likelihood:** Low · **Impact:** High
- **Mitigation:** Automated daily backups, 30-day retention, weekly long-term backups, documented restore procedure tested quarterly.

### 2.3 Integration fragility (ClickUp, Slack, Google, GitHub, Figma)
- **Likelihood:** High · **Impact:** Medium
- **Mitigation:** Treat all integrations as best-effort enrichments, never as hard dependencies. Cache last-known good data. Surface integration errors in admin, not to end users.

### 2.4 Security breach exposing personal or operational data
- **Likelihood:** Low · **Impact:** High
- **Mitigation:** RBAC enforced server-side; 2FA for privileged roles; secrets in managed vault; quarterly pen-tests; audit logging; least-privilege defaults; encryption at rest and in transit.

### 2.5 Notification spam erodes trust in notifications
- **Likelihood:** High · **Impact:** Medium
- **Mitigation:** Per-user notification preferences, quiet hours, intelligent grouping, daily digest option, strict rules on what qualifies as a notification vs. a dashboard signal.

---

## 3. Operational Risks

### 3.1 Managers don't act on the signals the system surfaces
- **Likelihood:** Medium · **Impact:** High
- **Mitigation:** Train managers on dashboards. Make manager response time itself a measurable metric. Escalate to PM if Team Lead doesn't act.

### 3.2 HR overrides erode data integrity
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Every override is audited with actor, reason, and timestamp. Overrides require a reason. Monthly review of override frequency.

### 3.3 Inconsistent reporting across departments
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Strictly structured templates. Per-field validation. Examples and tooltips. Periodic review by HR.

### 3.4 Time zone confusion in a distributed team
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Per-user timezone configuration; all times rendered locally; working hours defined per employee with override approval; "their local time" always shown next to "your local time."

---

## 4. Business Risks

### 4.1 Building features users never asked for
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Roadmap driven by stated core problems. In-app feedback widget. Quarterly user interviews. No feature ships without an owner persona and a success metric.

### 4.2 Scope creep delaying MVP
- **Likelihood:** High · **Impact:** High
- **Mitigation:** MVP scope is frozen at kickoff. New requests are logged but defer to v1.1+. Weekly scope review with the Owner.

### 4.3 Legal / compliance risk on employee data
- **Likelihood:** Low · **Impact:** High
- **Mitigation:** GDPR-aligned data handling; documented retention periods; data export and deletion workflows; DPA in place; consult legal before international rollouts.

### 4.4 Dependence on a single Owner-driven vision
- **Likelihood:** Medium · **Impact:** Medium
- **Mitigation:** Document the product vision and principles (this folder). Decision authority and review cadence written down. Cross-train at least two stakeholders per major decision area.

---

## 5. Adoption & Change-Management Risks

### 5.1 Existing chat-based habits compete with the new tool
- **Likelihood:** High · **Impact:** High
- **Mitigation:** Owner mandate to move attendance, reports, and dependencies into the Hub. Disable equivalent chat workflows. Recognize early adopters publicly.

### 5.2 Onboarding friction for new hires
- **Likelihood:** Low · **Impact:** Medium
- **Mitigation:** Guided tour on first login; HR-owned onboarding checklist; clear help center; first-day completion target.

---

## 6. Risk Register Summary

| ID | Risk | L | I | Owner |
|---|---|---|---|---|
| R-1.1 | Surveillance perception | H | H | Owner / HR |
| R-1.2 | Drift into task management | M | H | Product / Owner |
| R-1.3 | Low adoption | M | H | Owner / PM |
| R-2.4 | Security breach | L | H | Engineering / DevOps |
| R-3.1 | Managers ignore signals | M | H | PM |
| R-4.2 | Scope creep | H | H | Product |
| R-5.1 | Chat habits compete | H | H | Owner |

Risks are reviewed monthly and re-rated quarterly.
