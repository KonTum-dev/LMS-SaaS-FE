import type { EffectiveAccess, LmsModule, Organization } from "@/lib/types";
import { normalizeEffectiveModules } from "@/lib/entitlements";

export const DEFAULT_PRIMARY_COLOR = "#176BFF";

export function tenantPrimaryColor(organization: Organization | null) {
  return organization?.primaryColor?.trim() || DEFAULT_PRIMARY_COLOR;
}

export function organizationInitial(name?: string | null) {
  return Array.from(name?.trim() ?? "")[0]?.toLocaleUpperCase("vi") || "DX";
}

export function organizationDisplayName(name?: string | null) {
  return name?.trim() || "DX LMS";
}

export function tenantModuleEnabled(
  organization: Organization | null,
  module: LmsModule,
  effectiveAccess?: EffectiveAccess | null,
) {
  if (!organization) return false;
  return effectiveAccess === undefined
    ? normalizeEffectiveModules(organization.enabledModules).includes(module)
    : effectiveAccess
      ? normalizeEffectiveModules(effectiveAccess.modules).includes(module)
      : false;
}
