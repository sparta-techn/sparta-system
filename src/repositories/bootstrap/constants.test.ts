import { describe, expect, it } from "vitest";

import { permissionsForRoles } from "@/features/auth/permissions";
import { ROLE_RANK, type AppRole, type Permission } from "@/features/auth/types";
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
} from "./constants";

/**
 * The bootstrap seeds duplicate the role/permission matrix that
 * `features/auth/permissions.ts` owns (and that the DB seeds mirror in SQL).
 * These tests fail loudly if the copies ever drift apart.
 */
describe("bootstrap default role → permission matrix", () => {
  it("matches the authoritative permissions.ts matrix for every role", () => {
    for (const role of DEFAULT_ROLES) {
      const expected = permissionsForRoles([role]);
      const actual = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);
      expect(actual).toEqual(expected);
    }
  });

  it("only references permissions that exist in the default catalog", () => {
    const catalog = new Set<Permission>(DEFAULT_PERMISSIONS.map((p) => p.key));
    for (const role of DEFAULT_ROLES) {
      for (const key of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(catalog.has(key)).toBe(true);
      }
    }
  });
});

describe("bootstrap default roles", () => {
  it("covers every application role", () => {
    const known = new Set(Object.keys(ROLE_RANK) as AppRole[]);
    const seeded = new Set(DEFAULT_ROLES);
    expect(seeded).toEqual(known);
  });
});

describe("bootstrap default departments", () => {
  it("has unique slugs", () => {
    const slugs = DEFAULT_DEPARTMENTS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
