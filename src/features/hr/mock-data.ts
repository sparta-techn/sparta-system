/**
 * Mock data for the HR module. Pure UI scaffolding — no backend.
 * Structured to mirror future Supabase tables so swapping in real
 * fetchers is a one-line change per component.
 */

export type Department =
  | "Engineering"
  | "Design"
  | "Product"
  | "Data"
  | "QA"
  | "DevOps"
  | "Marketing"
  | "People Ops"
  | "Finance";

export type EmploymentStatus =
  "active" | "on_leave" | "invited" | "suspended" | "deactivated" | "offboarding";

export type EmployeeRole = "owner" | "super_admin" | "hr" | "manager" | "team_lead" | "employee";

export interface HrEmployee {
  id: string;
  /** Auth/profile id (`profiles.id` = `employees.user_id`). Present on live rows;
   * used by management writes that target `profiles`. Absent on mock seed data. */
  userId?: string;
  name: string;
  initials: string;
  email: string;
  phone?: string;
  avatarHue: number;
  department: Department;
  team: string;
  jobTitle: string;
  role: EmployeeRole;
  status: EmploymentStatus;
  managerId: string | null;
  joinedAt: string; // ISO
  birthday: string; // MM-DD
  location: string;
  timezone: string;
  employmentType: "Full-time" | "Part-time" | "Contractor";
  workMode: "Remote" | "Hybrid";
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

export interface HrInvitation {
  id: string;
  email: string;
  role: EmployeeRole;
  department: Department;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: InvitationStatus;
  /** Prefilled name for the invitee (captured at "Create Employee" time). */
  name?: string;
  /** Opaque token embedded in the setup link (mock — a real link is signed by Supabase). */
  token?: string;
  /** Last time the invite email was (re)sent. */
  resentAt?: string;
  /** When the invitee completed setup. */
  acceptedAt?: string;
}

export type LeaveType =
  "annual" | "sick" | "emergency" | "unpaid" | "remote_exception" | "parental";

export interface HrLeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt: string;
  approverId?: string;
}

export interface HrLeaveBalance {
  employeeId: string;
  annual: { used: number; total: number };
  sick: { used: number; total: number };
  emergency: { used: number; total: number };
  parental: { used: number; total: number };
}

export interface HrAttendanceIssue {
  id: string;
  employeeId: string;
  date: string;
  type: "late" | "missing_checkin" | "missing_midday" | "missing_eod" | "no_show";
  minutesLate?: number;
  note?: string;
}

export interface HrDocument {
  id: string;
  employeeId: string;
  category: "contract" | "nda" | "id" | "tax" | "certificate" | "performance";
  name: string;
  uploadedAt: string;
  uploadedBy: string;
  sizeKb: number;
}

export interface HrTeam {
  id: string;
  name: string;
  department: Department;
  leadId: string;
  memberCount: number;
}

export interface HrAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: "everyone" | "department" | "team" | "role";
  audienceLabel: string;
  authorId: string;
  scheduledFor: string;
  status: "draft" | "scheduled" | "sent";
  acknowledgements: number;
  reach: number;
}

export interface HrAuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  category: "employee" | "role" | "department" | "invitation" | "leave" | "document";
  details?: string;
}

export interface HrOnboardingTask {
  id: string;
  employeeId: string;
  label: string;
  owner: "hr" | "it" | "manager" | "employee";
  status: "todo" | "in_progress" | "done";
  dueAt?: string;
}

export interface HrOffboardingTask {
  id: string;
  employeeId: string;
  label: string;
  owner: "hr" | "it" | "manager";
  status: "todo" | "in_progress" | "done";
  exitDate: string;
}

// ---------- Seed data ----------

export const departments: Department[] = [
  "Engineering",
  "Design",
  "Product",
  "Data",
  "QA",
  "DevOps",
  "Marketing",
  "People Ops",
  "Finance",
];

const today = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return iso(d);
};
const daysFromNow = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const NAMES = [
  "Amelia Rivera",
  "Jonas Becker",
  "Priya Nair",
  "Marco Bianchi",
  "Hanna Lindqvist",
  "Diego Alvarez",
  "Sora Tanaka",
  "Noah Williams",
  "Aisha Karim",
  "Theo Laurent",
  "Mei Chen",
  "Liam O'Connor",
  "Yara Haddad",
  "Ravi Shah",
  "Elena Petrova",
  "Caleb Brooks",
  "Zara Khan",
  "Tomás Silva",
  "Linnea Holm",
  "Idris Bello",
  "Maya Cohen",
  "Ben Carter",
  "Anika Iyer",
  "Mateo Rossi",
  "Freya Larsen",
  "Hugo Martin",
  "Sienna Park",
  "Omar Faruk",
  "Naomi Bright",
  "Kenji Watanabe",
];

const TEAMS_BY_DEPT: Record<Department, string[]> = {
  Engineering: ["Platform", "Web", "Mobile", "Infra"],
  Design: ["Product Design", "Brand"],
  Product: ["Growth", "Core"],
  Data: ["Analytics", "ML"],
  QA: ["Automation", "Manual"],
  DevOps: ["SRE"],
  Marketing: ["Content", "Demand Gen"],
  "People Ops": ["HR"],
  Finance: ["Accounting"],
};

const TITLES_BY_DEPT: Record<Department, string[]> = {
  Engineering: ["Software Engineer", "Senior Engineer", "Staff Engineer", "Tech Lead"],
  Design: ["Product Designer", "Senior Designer", "Design Lead"],
  Product: ["Product Manager", "Senior PM", "Group PM"],
  Data: ["Data Analyst", "Data Engineer", "ML Engineer"],
  QA: ["QA Engineer", "Senior QA"],
  DevOps: ["DevOps Engineer", "SRE"],
  Marketing: ["Content Strategist", "Growth Marketer"],
  "People Ops": ["HR Generalist", "People Partner", "HR Lead"],
  Finance: ["Accountant", "Finance Analyst"],
};

const LOCATIONS = [
  "Berlin, DE",
  "Lisbon, PT",
  "Toronto, CA",
  "Buenos Aires, AR",
  "Tokyo, JP",
  "Cairo, EG",
  "Bengaluru, IN",
  "Stockholm, SE",
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}
function initialsOf(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const employees: HrEmployee[] = NAMES.map((name, i) => {
  const dept = pick(departments, i);
  const team = pick(TEAMS_BY_DEPT[dept], i);
  const title = pick(TITLES_BY_DEPT[dept], i);
  const join = new Date(today);
  join.setDate(join.getDate() - (i * 47 + 30));
  const isOnLeave = i % 11 === 3;
  const isInvited = i % 13 === 5;
  const isDeactivated = i === 28;
  const isOffboarding = i === 25;
  const role: EmployeeRole =
    i === 0
      ? "owner"
      : i === 1
        ? "super_admin"
        : dept === "People Ops"
          ? "hr"
          : i % 7 === 0
            ? "manager"
            : i % 6 === 0
              ? "team_lead"
              : "employee";
  return {
    id: `emp_${(i + 1).toString().padStart(3, "0")}`,
    name,
    initials: initialsOf(name),
    email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@spartaflow.dev",
    phone: `+1 555 ${(1000 + i * 7).toString().slice(0, 4)}`,
    avatarHue: (i * 37) % 360,
    department: dept,
    team,
    jobTitle: title,
    role,
    status: isDeactivated
      ? "deactivated"
      : isOffboarding
        ? "offboarding"
        : isInvited
          ? "invited"
          : isOnLeave
            ? "on_leave"
            : "active",
    managerId: i < 3 ? null : `emp_${((i % 5) + 1).toString().padStart(3, "0")}`,
    joinedAt: iso(join),
    birthday: `${((i % 12) + 1).toString().padStart(2, "0")}-${(((i * 3) % 27) + 1).toString().padStart(2, "0")}`,
    location: pick(LOCATIONS, i),
    timezone: pick(["CET", "WET", "EST", "ART", "JST", "EET", "IST", "CET"], i),
    employmentType: i % 9 === 0 ? "Contractor" : i % 5 === 0 ? "Part-time" : "Full-time",
    workMode: i % 4 === 0 ? "Hybrid" : "Remote",
  };
});

export const teams: HrTeam[] = Object.entries(TEAMS_BY_DEPT).flatMap(([dept, names]) =>
  names.map((name, i) => ({
    id: `team_${dept}_${i}`.toLowerCase().replace(/\s+/g, "_"),
    name,
    department: dept as Department,
    leadId: employees[(i * 5) % employees.length].id,
    memberCount: 3 + ((i + dept.length) % 6),
  })),
);

export const invitations: HrInvitation[] = [
  {
    id: "inv_001",
    email: "river.song@spartaflow.dev",
    role: "employee",
    department: "Engineering",
    invitedBy: "Amelia Rivera",
    invitedAt: daysAgo(2),
    expiresAt: daysFromNow(5),
    status: "pending",
  },
  {
    id: "inv_002",
    email: "owen.lee@spartaflow.dev",
    role: "team_lead",
    department: "Design",
    invitedBy: "Amelia Rivera",
    invitedAt: daysAgo(6),
    expiresAt: daysFromNow(1),
    status: "pending",
  },
  {
    id: "inv_003",
    email: "kai.murphy@spartaflow.dev",
    role: "employee",
    department: "QA",
    invitedBy: "Jonas Becker",
    invitedAt: daysAgo(14),
    expiresAt: daysAgo(7),
    status: "expired",
  },
  {
    id: "inv_004",
    email: "nora.frey@spartaflow.dev",
    role: "employee",
    department: "Marketing",
    invitedBy: "Amelia Rivera",
    invitedAt: daysAgo(20),
    expiresAt: daysAgo(13),
    status: "accepted",
  },
  {
    id: "inv_005",
    email: "sam.gold@spartaflow.dev",
    role: "employee",
    department: "Data",
    invitedBy: "Amelia Rivera",
    invitedAt: daysAgo(1),
    expiresAt: daysFromNow(6),
    status: "pending",
  },
  {
    id: "inv_006",
    email: "lia.park@spartaflow.dev",
    role: "hr",
    department: "People Ops",
    invitedBy: "Amelia Rivera",
    invitedAt: daysAgo(9),
    expiresAt: daysAgo(2),
    status: "cancelled",
  },
];

export const leaveBalances: HrLeaveBalance[] = employees.map((e, i) => ({
  employeeId: e.id,
  annual: { used: (i * 3) % 22, total: 25 },
  sick: { used: i % 7, total: 10 },
  emergency: { used: i % 3, total: 5 },
  parental: { used: 0, total: i % 10 === 0 ? 90 : 0 },
}));

export const leaveRequests: HrLeaveRequest[] = [
  {
    id: "lr_001",
    employeeId: "emp_005",
    type: "annual",
    from: daysFromNow(3),
    to: daysFromNow(10),
    days: 6,
    reason: "Family trip",
    status: "pending",
    submittedAt: daysAgo(1),
  },
  {
    id: "lr_002",
    employeeId: "emp_009",
    type: "sick",
    from: daysAgo(0),
    to: daysAgo(0),
    days: 1,
    reason: "Flu",
    status: "approved",
    submittedAt: daysAgo(0),
    approverId: "emp_001",
  },
  {
    id: "lr_003",
    employeeId: "emp_012",
    type: "remote_exception",
    from: daysFromNow(1),
    to: daysFromNow(1),
    days: 1,
    reason: "Coworking day",
    status: "pending",
    submittedAt: daysAgo(0),
  },
  {
    id: "lr_004",
    employeeId: "emp_017",
    type: "parental",
    from: daysFromNow(14),
    to: daysFromNow(74),
    days: 60,
    reason: "Parental leave",
    status: "pending",
    submittedAt: daysAgo(3),
  },
  {
    id: "lr_005",
    employeeId: "emp_022",
    type: "emergency",
    from: daysAgo(1),
    to: daysAgo(1),
    days: 1,
    reason: "Family emergency",
    status: "approved",
    submittedAt: daysAgo(1),
    approverId: "emp_002",
  },
  {
    id: "lr_006",
    employeeId: "emp_004",
    type: "annual",
    from: daysFromNow(20),
    to: daysFromNow(27),
    days: 6,
    reason: "Vacation",
    status: "pending",
    submittedAt: daysAgo(2),
  },
  {
    id: "lr_007",
    employeeId: "emp_014",
    type: "unpaid",
    from: daysFromNow(40),
    to: daysFromNow(54),
    days: 10,
    reason: "Personal",
    status: "rejected",
    submittedAt: daysAgo(5),
    approverId: "emp_001",
  },
];

export const attendanceIssues: HrAttendanceIssue[] = [
  { id: "ai_1", employeeId: "emp_003", date: daysAgo(0), type: "late", minutesLate: 22 },
  { id: "ai_2", employeeId: "emp_008", date: daysAgo(0), type: "missing_checkin" },
  { id: "ai_3", employeeId: "emp_015", date: daysAgo(0), type: "missing_midday" },
  { id: "ai_4", employeeId: "emp_021", date: daysAgo(1), type: "missing_eod" },
  { id: "ai_5", employeeId: "emp_006", date: daysAgo(1), type: "late", minutesLate: 12 },
  { id: "ai_6", employeeId: "emp_019", date: daysAgo(2), type: "no_show" },
];

export const documents: HrDocument[] = employees.flatMap((e, i) => [
  {
    id: `doc_${e.id}_c`,
    employeeId: e.id,
    category: "contract",
    name: `${e.name} – Contract.pdf`,
    uploadedAt: e.joinedAt,
    uploadedBy: "Amelia Rivera",
    sizeKb: 248,
  },
  {
    id: `doc_${e.id}_n`,
    employeeId: e.id,
    category: "nda",
    name: `${e.name} – NDA.pdf`,
    uploadedAt: e.joinedAt,
    uploadedBy: "Amelia Rivera",
    sizeKb: 112,
  },
  ...(i % 3 === 0
    ? [
        {
          id: `doc_${e.id}_t`,
          employeeId: e.id,
          category: "tax" as const,
          name: `${e.name} – Tax Form.pdf`,
          uploadedAt: e.joinedAt,
          uploadedBy: "HR Bot",
          sizeKb: 96,
        },
      ]
    : []),
]);

export const announcements: HrAnnouncement[] = [
  {
    id: "an_1",
    title: "Q3 All-hands recap",
    body: "Recording and slides are now available in the workspace.",
    audience: "everyone",
    audienceLabel: "Everyone",
    authorId: "emp_001",
    scheduledFor: daysAgo(1),
    status: "sent",
    acknowledgements: 78,
    reach: 92,
  },
  {
    id: "an_2",
    title: "Updated remote-work policy",
    body: "Effective next month. Please review and acknowledge.",
    audience: "everyone",
    audienceLabel: "Everyone",
    authorId: "emp_001",
    scheduledFor: daysFromNow(3),
    status: "scheduled",
    acknowledgements: 0,
    reach: 92,
  },
  {
    id: "an_3",
    title: "Engineering offsite – save the date",
    body: "We're meeting in Lisbon, Oct 14–18.",
    audience: "department",
    audienceLabel: "Engineering",
    authorId: "emp_002",
    scheduledFor: daysFromNow(7),
    status: "scheduled",
    acknowledgements: 0,
    reach: 28,
  },
  {
    id: "an_4",
    title: "Friendly reminder: submit timesheets",
    body: "Please close out the month by Friday.",
    audience: "role",
    audienceLabel: "Contractors",
    authorId: "emp_001",
    scheduledFor: daysAgo(0),
    status: "draft",
    acknowledgements: 0,
    reach: 6,
  },
];

export const auditLog: HrAuditEvent[] = [
  {
    id: "au_1",
    at: daysAgo(0),
    actor: "Amelia Rivera",
    action: "Invited",
    target: "river.song@spartaflow.dev",
    category: "invitation",
    details: "Role: Employee · Engineering",
  },
  {
    id: "au_2",
    at: daysAgo(0),
    actor: "Amelia Rivera",
    action: "Approved leave",
    target: "Hanna Lindqvist",
    category: "leave",
    details: "Sick · 1 day",
  },
  {
    id: "au_3",
    at: daysAgo(1),
    actor: "Jonas Becker",
    action: "Changed role",
    target: "Mei Chen",
    category: "role",
    details: "Employee → Team Lead",
  },
  {
    id: "au_4",
    at: daysAgo(2),
    actor: "Amelia Rivera",
    action: "Changed department",
    target: "Diego Alvarez",
    category: "department",
    details: "Design → Product",
  },
  {
    id: "au_5",
    at: daysAgo(3),
    actor: "System",
    action: "Invitation expired",
    target: "kai.murphy@spartaflow.dev",
    category: "invitation",
  },
  {
    id: "au_6",
    at: daysAgo(4),
    actor: "Amelia Rivera",
    action: "Deactivated",
    target: "Naomi Bright",
    category: "employee",
    details: "Reason: Offboarded",
  },
  {
    id: "au_7",
    at: daysAgo(5),
    actor: "Amelia Rivera",
    action: "Uploaded document",
    target: "Liam O'Connor",
    category: "document",
    details: "Performance review – H1",
  },
];

export const onboardingTasks: HrOnboardingTask[] = (() => {
  const targets = employees
    .filter((e) => e.status === "invited" || e.status === "active")
    .slice(0, 4);
  const labels = [
    { label: "Account created", owner: "hr" as const },
    { label: "Invitation accepted", owner: "employee" as const },
    { label: "Email verified", owner: "employee" as const },
    { label: "Equipment assigned", owner: "it" as const },
    { label: "Policies acknowledged", owner: "employee" as const },
    { label: "Orientation completed", owner: "hr" as const },
    { label: "Manager 1:1 scheduled", owner: "manager" as const },
  ];
  return targets.flatMap((e, i) =>
    labels.map((l, j) => ({
      id: `ob_${e.id}_${j}`,
      employeeId: e.id,
      label: l.label,
      owner: l.owner,
      status: (j < 3 - (i % 4) ? "done" : j === 3 - (i % 4) ? "in_progress" : "todo") as
        "todo" | "in_progress" | "done",
      dueAt: daysFromNow(j),
    })),
  );
})();

export const offboardingTasks: HrOffboardingTask[] = (() => {
  const target = employees.find((e) => e.status === "offboarding")!;
  const labels = [
    { label: "Disable account", owner: "it" as const },
    { label: "Collect equipment", owner: "it" as const },
    { label: "Transfer ownership", owner: "manager" as const },
    { label: "Archive documents", owner: "hr" as const },
    { label: "Exit interview", owner: "hr" as const },
  ];
  return labels.map((l, j) => ({
    id: `off_${target.id}_${j}`,
    employeeId: target.id,
    label: l.label,
    owner: l.owner,
    status: (j < 2 ? "done" : j === 2 ? "in_progress" : "todo") as "todo" | "in_progress" | "done",
    exitDate: daysFromNow(7),
  }));
})();

// ---------- Derived helpers ----------

export function employeeById(id: string) {
  return employees.find((e) => e.id === id);
}

function birthdayWithinNextDays(mmdd: string, days: number) {
  const [m, d] = mmdd.split("-").map(Number);
  const now = new Date();
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
  const diff = (next.getTime() - now.getTime()) / 86400000;
  return diff <= days;
}

export function upcomingBirthdays(days = 30) {
  return employees
    .filter((e) => e.status === "active" && birthdayWithinNextDays(e.birthday, days))
    .slice(0, 8);
}

export function upcomingAnniversaries(days = 30) {
  const now = new Date();
  return employees
    .filter((e) => e.status === "active")
    .map((e) => {
      const j = new Date(e.joinedAt);
      const next = new Date(now.getFullYear(), j.getMonth(), j.getDate());
      if (next < now) next.setFullYear(now.getFullYear() + 1);
      const diff = (next.getTime() - now.getTime()) / 86400000;
      const years = next.getFullYear() - j.getFullYear();
      return { employee: e, in: Math.round(diff), years };
    })
    .filter((x) => x.in <= days && x.years > 0)
    .sort((a, b) => a.in - b.in)
    .slice(0, 8);
}

export function newHires(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return employees.filter((e) => new Date(e.joinedAt) >= cutoff);
}

export const hrKpis = {
  total: employees.length,
  active: employees.filter((e) => e.status === "active").length,
  onLeave: employees.filter((e) => e.status === "on_leave").length,
  newHires: newHires(30).length,
  late: attendanceIssues.filter((i) => i.type === "late").length,
  attendanceCompliance: Math.round(
    100 - (attendanceIssues.length / Math.max(employees.length, 1)) * 100,
  ),
  pendingInvitations: invitations.filter((i) => i.status === "pending").length,
  pendingLeave: leaveRequests.filter((r) => r.status === "pending").length,
  upcomingBirthdays: upcomingBirthdays().length,
  upcomingAnniversaries: upcomingAnniversaries().length,
};
