import { describe, expect, it } from "vitest";
import {
  assessmentAvailabilityAt,
  assessmentRemainingSeconds,
  serverAlignedNow,
} from "@/lib/assessment-time";

describe("assessment time authority", () => {
  it("advances a cached server snapshot from its cache receipt time", () => {
    const receivedAt = Date.parse("2030-08-20T08:00:00.000Z");

    expect(serverAlignedNow(
      "2030-08-20T12:00:00.000Z",
      receivedAt,
      receivedAt + 5 * 60 * 1_000,
    )).toBe(Date.parse("2030-08-20T12:05:00.000Z"));
  });

  it("derives availability at both boundaries using server-aligned time", () => {
    const assessment = {
      closesAt: "2030-08-20T08:10:00.000Z",
      opensAt: "2030-08-20T08:05:00.000Z",
    };

    expect(assessmentAvailabilityAt(
      assessment,
      Date.parse("2030-08-20T08:04:59.999Z"),
      "OPEN",
    )).toBe("UPCOMING");
    expect(assessmentAvailabilityAt(
      assessment,
      Date.parse("2030-08-20T08:05:00.000Z"),
      "UPCOMING",
    )).toBe("OPEN");
    expect(assessmentAvailabilityAt(
      assessment,
      Date.parse("2030-08-20T08:10:00.000Z"),
      "OPEN",
    )).toBe("CLOSED");
    expect(assessmentAvailabilityAt(
      { closesAt: null, opensAt: "not-a-date" },
      Date.parse("2030-08-20T08:05:00.000Z"),
      "CLOSED",
    )).toBe("CLOSED");
    expect(assessmentAvailabilityAt(
      { closesAt: null, opensAt: null },
      Date.parse("2030-08-20T08:05:00.000Z"),
      "CLOSED",
    )).toBe("CLOSED");
  });

  it("clamps an expired deadline and ignores deadlines on terminal attempts", () => {
    const deadline = "2030-08-20T08:10:00.000Z";

    expect(assessmentRemainingSeconds(
      deadline,
      "IN_PROGRESS",
      Date.parse("2030-08-20T08:10:01.000Z"),
    )).toBe(0);
    expect(assessmentRemainingSeconds(
      deadline,
      "SUBMITTED",
      Date.parse("2030-08-20T08:00:00.000Z"),
    )).toBeNull();
  });
});
