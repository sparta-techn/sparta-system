# Success Metrics — SpartaFlow Hub

Metrics are grouped into **adoption**, **operational quality**, **engagement**, **system health**, and **business outcomes**. Each metric has a definition, target, owner, and review cadence.

---

## 1. Adoption Metrics

| Metric                    | Definition                                                                              | Target                    | Owner        | Cadence    |
| ------------------------- | --------------------------------------------------------------------------------------- | ------------------------- | ------------ | ---------- |
| Daily Active Users (DAU)  | Unique users who complete at least Start Work                                           | ≥ 95% of active employees | Product      | Daily      |
| Full Flow Completion Rate | % of working days where all 5 steps (Start, Morning, Midday, EOD, Finish) are completed | ≥ 90%                     | Product      | Daily      |
| Time to First Value       | Time from first login to first completed daily flow                                     | < 1 working day           | Product / HR | Per cohort |
| Feature Adoption Rate     | % of users using a given feature in the last 30 days                                    | ≥ 70% for core features   | Product      | Monthly    |

---

## 2. Operational Quality Metrics

| Metric                     | Definition                                                | Target             | Owner                 | Cadence |
| -------------------------- | --------------------------------------------------------- | ------------------ | --------------------- | ------- |
| Attendance Compliance      | % of working days with on-time Start Work (≤ 10:00)       | ≥ 95%              | HR                    | Weekly  |
| Daily Report Completion    | % of working days with EOD report submitted               | ≥ 90%              | Team Leads / PM       | Daily   |
| Average Check-in Time      | Mean time taken to complete the morning check-in          | < 60 seconds       | Product               | Weekly  |
| Dependency Resolution Time | Median time from dependency created → resolved            | < 24 working hours | PM / Department Leads | Weekly  |
| Blocker Age                | Median age of currently open blockers                     | < 1 working day    | Team Leads            | Daily   |
| Manager Response Time      | Median time from blocker raised → manager acknowledgement | < 2 working hours  | Team Leads / PM       | Daily   |
| Late-Arrival Rate          | % of working days with late arrival                       | ≤ 5%               | HR                    | Weekly  |
| Break Compliance           | % of working days within 1-hour break cap                 | ≥ 95%              | HR                    | Weekly  |

---

## 3. Engagement Metrics

| Metric                        | Definition                                            | Target                  | Owner   | Cadence          |
| ----------------------------- | ----------------------------------------------------- | ----------------------- | ------- | ---------------- |
| Employee Engagement Score     | Quarterly in-app survey (1–10)                        | ≥ 8                     | HR      | Quarterly        |
| Announcement Read Rate        | % of recipients who read announcements within 24 h    | ≥ 85%                   | HR      | Per announcement |
| Streak Distribution           | Distribution of consecutive full-flow days            | Median streak ≥ 10 days | Product | Monthly          |
| Net Promoter Score (internal) | "Would you recommend this tool stay in our workflow?" | ≥ +40                   | Product | Quarterly        |

---

## 4. Manager & Owner Visibility Metrics

| Metric                    | Definition                                                     | Target           | Owner |
| ------------------------- | -------------------------------------------------------------- | ---------------- | ----- |
| Time-to-Status            | Time a manager spends to learn the team's status               | < 30 seconds     | PM    |
| Risk Detection Lead Time  | Time between a blocker emerging and a manager seeing it        | < 1 working hour | PM    |
| Owner Dashboard Open Rate | % of working days the Owner opens the company health dashboard | ≥ 80%            | Owner |

---

## 5. System Health Metrics

| Metric                 | Definition                                 | Target   | Owner       |
| ---------------------- | ------------------------------------------ | -------- | ----------- |
| Uptime                 | Monthly availability                       | ≥ 99.9%  | DevOps      |
| P95 Page Load          | 95th-percentile page load on key pages     | < 2 s    | Engineering |
| P95 API Latency        | 95th-percentile read latency on dashboards | < 300 ms | Engineering |
| Error Rate             | 5xx responses / total requests             | < 0.1%   | Engineering |
| MTTR                   | Mean time to recover from an incident      | < 1 hour | DevOps      |
| Backup Restore Success | Quarterly restore test pass rate           | 100%     | DevOps      |

---

## 6. Business Outcome Metrics

| Metric                        | Definition                                             | Target                 | Owner      |
| ----------------------------- | ------------------------------------------------------ | ---------------------- | ---------- |
| Manager Time Saved            | Self-reported weekly hours saved on status chasing     | ≥ 3 h / manager / week | Owner      |
| Risks Detected Early          | Risks surfaced ≥ 3 working days before deadline impact | ≥ 70% of total risks   | PM         |
| Reduction in Missed Deadlines | Year-over-year reduction in missed project deadlines   | ≥ 30%                  | Owner / PM |
| Onboarding Time               | Days for a new hire to be operationally productive     | ≤ 2 working days       | HR         |

---

## 7. Composite: Company Health Score

A single composite score (0–100) shown on the Owner dashboard, computed from:

- 25% Attendance Compliance
- 25% Daily Report Completion
- 20% Dependency Resolution Time (inverted)
- 15% Manager Response Time (inverted)
- 15% Engagement Score

Target: **≥ 85** sustained over 90 days.

---

## 8. Review Cadence

- **Daily**: adoption, operational quality, system health (dashboards).
- **Weekly**: team-level operational quality, with Team Leads.
- **Monthly**: full metric review with PM, HR, Owner.
- **Quarterly**: strategic review and roadmap re-prioritization based on metrics.
