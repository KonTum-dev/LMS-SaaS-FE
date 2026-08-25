import { describe, expect, it } from "vitest";
import type { Organization } from "./types";
import { DEFAULT_PRIMARY_COLOR, tenantModuleEnabled, tenantPrimaryColor } from "./workspace";

const organization: Organization = {
  _id: "tenant-a",
  enabledModules: ["COURSES", "ASSIGNMENTS"],
  logoUrl: null,
  name: "Bright Academy",
  primaryColor: "#123456",
  slug: "bright-academy",
  status: "ACTIVE",
};

describe("tenant workspace configuration", () => {
  it("adopts the tenant primary color and falls back before authentication", () => {
    expect(tenantPrimaryColor(organization)).toBe("#123456");
    expect(tenantPrimaryColor(null)).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it("hides disabled modules while preserving enabled modules", () => {
    expect(tenantModuleEnabled(organization, "COURSES")).toBe(true);
    expect(tenantModuleEnabled(organization, "USERS")).toBe(false);
  });
});
