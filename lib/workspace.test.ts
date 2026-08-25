import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Organization } from "./types";
import {
  DEFAULT_PRIMARY_COLOR,
  organizationDisplayName,
  organizationInitial,
  tenantModuleEnabled,
  tenantPrimaryColor,
} from "./workspace";

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
    expect(tenantPrimaryColor({ ...organization, primaryColor: "  " })).toBe(DEFAULT_PRIMARY_COLOR);
    expect(DEFAULT_PRIMARY_COLOR).toBe("#176BFF");
  });

  it("tạo fallback tên và ký tự đầu an toàn cho tên rỗng, khoảng trắng và Unicode", () => {
    expect(organizationDisplayName("  Dolphin Academy  ")).toBe("Dolphin Academy");
    expect(organizationDisplayName("   ")).toBe("DX LMS");
    expect(organizationInitial("  đức minh")).toBe("Đ");
    expect(organizationInitial("🐬 Academy")).toBe("🐬");
    expect(organizationInitial("   ")).toBe("DX");
  });

  it("hides disabled modules while preserving enabled modules", () => {
    expect(tenantModuleEnabled(organization, "COURSES")).toBe(true);
    expect(tenantModuleEnabled(organization, "USERS")).toBe(false);
  });

  it("dùng chung palette DX và helper fallback trên các Web surface", () => {
    const globals = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const settings = readFileSync(resolve(process.cwd(), "app/(workspace)/settings/page.tsx"), "utf8");
    const tenants = readFileSync(resolve(process.cwd(), "app/(workspace)/admin/tenants/page.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "components/layout/workspace-shell.tsx"), "utf8");

    expect(globals).toContain("#176bff");
    expect(globals).toContain("#19cfe8");
    expect(globals).not.toMatch(/#5b5bd6|#4b4dc8|#8d7cf2|#4447c7/i);
    expect(settings).toContain("primaryColor: DEFAULT_PRIMARY_COLOR");
    expect(settings).toContain("organizationInitial(organization?.name)");
    expect(tenants).toContain("primaryColor: DEFAULT_PRIMARY_COLOR");
    expect(shell).toContain("organizationInitial(organization?.name)");
    expect(shell).not.toContain("#5B5BD6");
  });
});
