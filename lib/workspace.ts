import type { LmsModule, Organization } from "@/lib/types";

export const DEFAULT_PRIMARY_COLOR = "#5B5BD6";

export function tenantPrimaryColor(organization: Organization | null) {
  return organization?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
}

export function tenantModuleEnabled(
  organization: Organization | null,
  module: LmsModule,
) {
  return organization?.enabledModules?.includes(module) ?? true;
}
