import type { BillingPlanInput, LmsModule } from "@/lib/types";
import { includeLmsModulePrerequisites } from "@/lib/entitlements";

export interface BillingPlanFormValues extends Omit<BillingPlanInput, "entitlements" | "features"> {
  entitlements: {
    maxActiveLearners?: number | null;
    maxBranches?: number | null;
    maxCourses?: number | null;
    maxUsers?: number | null;
    modules: LmsModule[];
  };
  featuresText?: string;
}

export function buildBillingPlanPayload(values: BillingPlanFormValues): BillingPlanInput {
  const { entitlements, featuresText, ...planValues } = values;
  return {
    ...planValues,
    entitlements: {
      maxActiveLearners: entitlements.maxActiveLearners ?? null,
      maxBranches: entitlements.maxBranches ?? null,
      maxCourses: entitlements.maxCourses ?? null,
      maxUsers: entitlements.maxUsers ?? null,
      modules: includeLmsModulePrerequisites(entitlements.modules),
    },
    features: featuresText?.split("\n").map((item) => item.trim()).filter(Boolean) ?? [],
  };
}
