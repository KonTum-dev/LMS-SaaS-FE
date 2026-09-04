import type { AssessmentAvailability } from "@/lib/assessment-api";

interface AssessmentWindow {
  closesAt: string | null;
  opensAt: string | null;
}

/**
 * Advances a server clock snapshot by elapsed client time. `receivedAt` must be
 * the time at which that snapshot entered the query cache, not the time at
 * which a component later remounts from that cache.
 */
export function serverAlignedNow(
  serverNow: string | null | undefined,
  receivedAt: number,
  clientNow: number,
): number {
  const snapshot = serverNow ? Date.parse(serverNow) : Number.NaN;
  const received = Number.isFinite(receivedAt) && receivedAt > 0
    ? receivedAt
    : clientNow;
  return Number.isFinite(snapshot)
    ? snapshot + Math.max(0, clientNow - received)
    : clientNow;
}

export function assessmentAvailabilityAt(
  assessment: AssessmentWindow,
  now: number,
  fallback: AssessmentAvailability,
): AssessmentAvailability {
  if (!Number.isFinite(now)) return fallback;
  const opensAt = assessment.opensAt ? Date.parse(assessment.opensAt) : null;
  const closesAt = assessment.closesAt ? Date.parse(assessment.closesAt) : null;
  if (
    (assessment.opensAt !== null && !Number.isFinite(opensAt))
    || (assessment.closesAt !== null && !Number.isFinite(closesAt))
  ) return fallback;
  if (opensAt === null && closesAt === null) return fallback;
  if (opensAt !== null && Number.isFinite(opensAt) && now < opensAt) {
    return "UPCOMING";
  }
  if (closesAt !== null && Number.isFinite(closesAt) && now >= closesAt) {
    return "CLOSED";
  }
  return "OPEN";
}

export function assessmentRemainingSeconds(
  deadlineAt: string | null,
  status: string,
  now: number,
): number | null {
  if (!deadlineAt || status !== "IN_PROGRESS") return null;
  const deadline = Date.parse(deadlineAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}
