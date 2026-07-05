/**
 * Profile source — who is asking. Reads the profile, roles and employment record
 * through the service layer. Never touches auth UI or feature stores.
 */

import { authService, employeesService } from "@/services";
import type { ContextSource } from "../../types";
import { emptyFragment, fragment, snippet } from "./source-utils";

export const profileSource: ContextSource = {
  key: "profile",
  label: "Profile",

  async gather({ userId }) {
    const [profile, roles, employment] = await Promise.all([
      authService.getProfile(userId),
      authService.getRoles(userId),
      employeesService.getByUserId(userId),
    ]);

    if (!profile) {
      return emptyFragment("profile", this.label, "No profile on record.");
    }

    const name = profile.display_name ?? profile.full_name ?? profile.email;
    const bits = [
      profile.job_title ? `title: ${profile.job_title}` : null,
      roles.length ? `roles: ${roles.join(", ")}` : "roles: none",
      `status: ${profile.status}`,
      profile.timezone ? `tz: ${profile.timezone}` : null,
      employment?.work_location ? `location: ${employment.work_location}` : null,
      employment?.work_mode ? `mode: ${employment.work_mode}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    return fragment("profile", this.label, [
      {
        type: "profile",
        id: profile.id,
        ref: profile.email,
        summary: snippet(`${name} — ${bits}`, 200),
      },
    ]);
  },
};
